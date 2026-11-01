import { NextRequest, NextResponse } from "next/server";
import {
  createPaymentRequirement,
  paymentHeaders,
  verifyPayment,
  releaseOnFail,
} from "@/lib/payment";
import { estimateCostSats, actualCostSats } from "@/lib/pricing";
import { chatCompletion, chatCompletionStream, type ChatMessage } from "@/lib/grok";
import { getClientByApiKey, logUsage, deductCredits, refundOnFail, addCredits } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const rateCheck = await checkRateLimit(`ip:${ip}`, 60_000, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil((rateCheck.resetAt.getTime() - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    const body = await request.json();
    const { model, messages, temperature, max_tokens, stream } = body as {
      model?: string;
      messages?: ChatMessage[];
      temperature?: number;
      max_tokens?: number;
      stream?: boolean;
    };

    if (!model || !messages?.length) {
      return NextResponse.json(
        { error: "model and messages are required" },
        { status: 400 }
      );
    }

    // Calculate base cost
    let cost;
    try {
      cost = await estimateCostSats(model, messages);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Pricing error" },
        { status: 400 }
      );
    }

    // Check for API key auth
    const authHeader = request.headers.get("authorization");
    const apiKey = authHeader?.startsWith("Bearer bsvapi_sk_")
      ? authHeader.slice(7)
      : null;
    const client = apiKey ? await getClientByApiKey(apiKey) : null;

    // Apply client discount
    let effectiveCostSats = cost.satoshis;
    let effectiveCostUsd = cost.usdCost;
    if (client && client.discount_percent > 0) {
      const multiplier = 1 - client.discount_percent / 100;
      effectiveCostSats = Math.max(Math.ceil(cost.satoshis * multiplier), 100);
      effectiveCostUsd = cost.usdCost * multiplier;
    }

    // Authenticated client — deduct credits and proxy
    if (client) {
      // Rate limit by key too
      const keyRate = await checkRateLimit(`key:${client.key}`, 60_000, 120);
      if (!keyRate.allowed) {
        return NextResponse.json(
          { error: "API key rate limit exceeded" },
          { status: 429 }
        );
      }

      // Deduct credits upfront
      if (client.user_id) {
        const deduction = await deductCredits(
          client.user_id,
          effectiveCostSats,
          `api_call:${model}`
        );
        if (!deduction.success) {
          return NextResponse.json(
            {
              error: "Insufficient credits",
              credits_sats: deduction.balance,
              required_sats: effectiveCostSats,
            },
            { status: 402 }
          );
        }
      }

      // Streaming mode
      if (stream) {
        const { stream: sseStream } = await refundOnFail(client.user_id, effectiveCostSats, `api_call:${model}`, () => chatCompletionStream({
          model,
          messages,
          temperature,
          max_tokens,
        }));

        // Log estimated usage (actual tokens unknown until stream ends)
        logUsage({
          user_id: client.user_id || undefined,
          api_key_id: client.id,
          model,
          input_tokens: 0,
          output_tokens: 0,
          cost_sats: effectiveCostSats,
          cost_usd: effectiveCostUsd,
        });

        return new Response(sseStream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      // Non-streaming
      const grokResponse = await refundOnFail(client.user_id, effectiveCostSats, `api_call:${model}`, () => chatCompletion({
        model,
        messages,
        temperature,
        max_tokens,
      }));

      const usage = grokResponse.usage;
      const realCostSats = await actualCostSats(
        model,
        usage?.prompt_tokens || 0,
        usage?.completion_tokens || 0
      );
      const discountedRealCost =
        client.discount_percent > 0
          ? Math.max(
              Math.ceil(realCostSats * (1 - client.discount_percent / 100)),
              100
            )
          : realCostSats;

      // Charge what the call actually cost: the estimate was deducted up front, so give back the difference.
      const change = effectiveCostSats - discountedRealCost;
      if (client.user_id && change > 0) await addCredits(client.user_id, change, `change:${model}`);

      logUsage({
        user_id: client.user_id || undefined,
        api_key_id: client.id,
        model,
        input_tokens: usage?.prompt_tokens || 0,
        output_tokens: usage?.completion_tokens || 0,
        cost_sats: discountedRealCost,
        cost_usd: effectiveCostUsd,
      });

      return NextResponse.json({
        ...grokResponse,
        billing: {
          tier: client.tier,
          discountPercent: client.discount_percent,
          costSatoshis: discountedRealCost,
        },
      });
    }

    // Anonymous mode — require BSV payment
    const paymentHeader = request.headers.get("x-bsv-payment");

    if (!paymentHeader) {
      const requirement = createPaymentRequirement(effectiveCostSats);
      const headers = paymentHeaders(requirement);

      return NextResponse.json(
        {
          error: "Payment Required",
          satoshisRequired: effectiveCostSats,
          usdEquivalent: `$${effectiveCostUsd.toFixed(6)}`,
          breakdown: cost.breakdown,
          instructions:
            "Send BSV payment and include txid in x-bsv-payment header. Or sign up at bsvapi.com for an API key.",
        },
        { status: 402, headers }
      );
    }

    // Verify BSV payment
    const verification = await verifyPayment(paymentHeader, effectiveCostSats);

    if (!verification.valid) {
      return NextResponse.json(
        { error: `Payment invalid: ${verification.error}` },
        { status: 402 }
      );
    }

    // Streaming for anonymous payment
    if (stream) {
      // Upstream call. If it throws, releaseOnFail frees the txid so the payer can retry without paying twice.
      const { stream: sseStream } = await releaseOnFail(verification.txid!, () => chatCompletionStream({
        model,
        messages,
        temperature,
        max_tokens,
      }));
      logUsage({
        model,
        input_tokens: 0,
        output_tokens: 0,
        cost_sats: effectiveCostSats,
        cost_usd: effectiveCostUsd,
        payment_txid: verification.txid,
      });

      return new Response(sseStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Upstream call. If it throws, releaseOnFail frees the txid so the payer can retry without paying twice.
    const grokResponse = await releaseOnFail(verification.txid!, () => chatCompletion({
      model,
      messages,
      temperature,
      max_tokens,
    }));
    logUsage({
      model,
      input_tokens: grokResponse.usage?.prompt_tokens || 0,
      output_tokens: grokResponse.usage?.completion_tokens || 0,
      cost_sats: effectiveCostSats,
      cost_usd: effectiveCostUsd,
      payment_txid: verification.txid,
    });

    return NextResponse.json({
      ...grokResponse,
      payment: {
        txid: verification.txid,
        satoshisPaid: verification.satoshisPaid,
        satoshisRequired: effectiveCostSats,
      },
    });
  } catch (err) {
    console.error("Chat completions error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
