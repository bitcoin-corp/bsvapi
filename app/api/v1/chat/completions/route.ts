import { NextRequest, NextResponse } from "next/server";
import {
  createPaymentRequirement,
  paymentHeaders,
  verifyPayment,
  markPrefixUsed,
} from "@/lib/payment";
import { estimateCostSats, actualCostSats } from "@/lib/pricing";
import { chatCompletion, type ChatMessage } from "@/lib/grok";
import { getClientByApiKey, logUsage } from "@/lib/db";

/**
 * POST /api/v1/chat/completions
 *
 * OpenAI-compatible chat completions endpoint.
 *
 * Two auth modes:
 * 1. API key (Authorization: Bearer bsvapi_sk_xxx) — for registered clients, metered + invoiced
 * 2. BSV payment (x-bsv-payment header) — anonymous, pay-per-call
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { model, messages, temperature, max_tokens } = body as {
      model?: string;
      messages?: ChatMessage[];
      temperature?: number;
      max_tokens?: number;
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

    // Check for API key auth (registered clients)
    const authHeader = request.headers.get("authorization");
    const apiKey = authHeader?.startsWith("Bearer bsvapi_sk_")
      ? authHeader.slice(7)
      : null;
    const client = apiKey ? getClientByApiKey(apiKey) : null;

    // Apply client discount
    let effectiveCostSats = cost.satoshis;
    let effectiveCostUsd = cost.usdCost;
    if (client && client.discountPercent > 0) {
      const multiplier = 1 - client.discountPercent / 100;
      effectiveCostSats = Math.max(
        Math.ceil(cost.satoshis * multiplier),
        100
      );
      effectiveCostUsd = cost.usdCost * multiplier;
    }

    // If authenticated client — skip BSV payment, meter the call
    if (client) {
      // Proxy to Grok
      const grokResponse = await chatCompletion({
        model,
        messages,
        temperature,
        max_tokens,
      });

      // Calculate actual cost from real token usage
      const usage = grokResponse.usage;
      const realCostSats = await actualCostSats(
        model,
        usage?.prompt_tokens || 0,
        usage?.completion_tokens || 0
      );
      const discountedRealCost = client.discountPercent > 0
        ? Math.max(Math.ceil(realCostSats * (1 - client.discountPercent / 100)), 100)
        : realCostSats;

      // Log usage
      logUsage({
        clientId: client.id,
        model,
        inputTokens: usage?.prompt_tokens || 0,
        outputTokens: usage?.completion_tokens || 0,
        costSatoshis: discountedRealCost,
        costUsd: effectiveCostUsd,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json({
        ...grokResponse,
        billing: {
          client: client.slug,
          tier: client.tier,
          discountPercent: client.discountPercent,
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
            "Send BSV payment and include txid in x-bsv-payment header. Or use an API key: Authorization: Bearer bsvapi_sk_xxx",
        },
        { status: 402, headers }
      );
    }

    // Verify BSV payment
    const verification = await verifyPayment(
      paymentHeader,
      effectiveCostSats
    );

    if (!verification.valid) {
      return NextResponse.json(
        { error: `Payment invalid: ${verification.error}` },
        { status: 402 }
      );
    }

    // Payment verified — proxy to Grok
    const grokResponse = await chatCompletion({
      model,
      messages,
      temperature,
      max_tokens,
    });

    // Mark derivation prefix as used
    const prefix = request.headers.get("x-bsv-payment-derivation-prefix");
    if (prefix) markPrefixUsed(prefix);

    // Log anonymous usage
    logUsage({
      clientId: "anonymous",
      model,
      inputTokens: grokResponse.usage?.prompt_tokens || 0,
      outputTokens: grokResponse.usage?.completion_tokens || 0,
      costSatoshis: effectiveCostSats,
      costUsd: effectiveCostUsd,
      paymentTxid: verification.txid,
      timestamp: new Date().toISOString(),
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
