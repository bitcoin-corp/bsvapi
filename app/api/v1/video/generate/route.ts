import { NextRequest, NextResponse } from "next/server";
import {
  createPaymentRequirement,
  paymentHeaders,
  verifyPayment,
  releaseOnFail,
} from "@/lib/payment";
import { getServiceCostSats } from "@/lib/pricing";
import { generateVideo } from "@/lib/atlascloud";
import { getClientByApiKey, logUsage, deductCredits, refundOnFail } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp, errorResponse } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP
    const ip = clientIp(request);
    const rateCheck = await checkRateLimit(`ip:${ip}`, 60_000, 20);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(
              (rateCheck.resetAt.getTime() - Date.now()) / 1000
            ).toString(),
          },
        }
      );
    }

    const body = await request.json();
    const { prompt, model, image_url, duration } = body as {
      prompt?: string;
      model?: string;
      image_url?: string;
      duration?: number;
    };

    if (!prompt) {
      return NextResponse.json(
        { error: "prompt is required" },
        { status: 400 }
      );
    }

    // Only models we have priced may reach the provider (see the images route). These are the ids this route has
    // always sent; any other caller-named provider model is refused instead of being run at the Wan price.
    const VIDEO_MODELS: Record<string, string> = {
      "wan-2.1": "video-wan",
      kling: "video-kling",
    };
    const videoModel = model ?? "wan-2.1";
    const serviceKey = VIDEO_MODELS[videoModel];
    if (!serviceKey) {
      return NextResponse.json(
        { error: `Unsupported video model: ${videoModel}. Available: ${Object.keys(VIDEO_MODELS).join(", ")}` },
        { status: 400 }
      );
    }

    let cost;
    try {
      cost = await getServiceCostSats(serviceKey);
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
      effectiveCostSats = Math.max(
        Math.ceil(cost.satoshis * multiplier),
        100
      );
      effectiveCostUsd = cost.usdCost * multiplier;
    }

    // Authenticated client — deduct credits and proxy
    if (client) {
      const keyRate = await checkRateLimit(`key:${client.key}`, 60_000, 30);
      if (!keyRate.allowed) {
        return NextResponse.json(
          { error: "API key rate limit exceeded" },
          { status: 429 }
        );
      }

      if (client.user_id) {
        const deduction = await deductCredits(
          client.user_id,
          effectiveCostSats,
          `api_call:${serviceKey}`
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

      const result = await refundOnFail(client.user_id, effectiveCostSats, `api_call:${serviceKey}`, () => generateVideo({
        prompt,
        model: videoModel,
        image_url,
        duration,
      }));

      logUsage({
        user_id: client.user_id || undefined,
        api_key_id: client.id,
        model: serviceKey,
        input_tokens: 0,
        output_tokens: 0,
        cost_sats: effectiveCostSats,
        cost_usd: effectiveCostUsd,
      });

      return NextResponse.json({
        ...result,
        billing: {
          tier: client.tier,
          discountPercent: client.discount_percent,
          costSatoshis: effectiveCostSats,
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
          service: serviceKey,
          description: cost.description,
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

    // Upstream call. If it throws, releaseOnFail frees the txid so the payer can retry without paying twice.
    const result = await releaseOnFail(verification.txid!, () => generateVideo({
      prompt,
      model: videoModel,
      image_url,
      duration,
    }));
    logUsage({
      model: serviceKey,
      input_tokens: 0,
      output_tokens: 0,
      cost_sats: effectiveCostSats,
      cost_usd: effectiveCostUsd,
      payment_txid: verification.txid,
    });

    return NextResponse.json({
      ...result,
      payment: {
        txid: verification.txid,
        satoshisPaid: verification.satoshisPaid,
        satoshisRequired: effectiveCostSats,
      },
    });
  } catch (err) {
    return errorResponse(err, "Video generation error");
  }
}
