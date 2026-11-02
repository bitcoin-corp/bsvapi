import { NextRequest, NextResponse } from "next/server";
import {
  createPaymentRequirement,
  paymentHeaders,
  verifyPayment,
  releaseOnFail,
} from "@/lib/payment";
import { getServiceCostSats } from "@/lib/pricing";
import { generateImage } from "@/lib/atlascloud";
import { getClientByApiKey, logUsage, deductCredits, refundOnFail } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp, errorResponse } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP
    const ip = clientIp(request);
    const rateCheck = await checkRateLimit(`ip:${ip}`, 60_000, 30);
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
    const { prompt, model, width, height } = body as {
      prompt?: string;
      model?: string;
      width?: number;
      height?: number;
    };

    if (!prompt) {
      return NextResponse.json(
        { error: "prompt is required" },
        { status: 400 }
      );
    }

    // Only models we have priced may reach the provider: forwarding any caller-named model would let a caller run a
    // dear model at the cheapest price.
    const IMAGE_MODELS: Record<string, string> = {
      sdxl: "image-sdxl",
      "z-image/turbo": "image-sdxl",
      "flux-schnell": "image-flux",
      "bytedance/seedream-v5.0-lite": "image-flux",
    };
    const imageModel = model ?? "sdxl";
    const serviceKey = IMAGE_MODELS[imageModel];
    if (!serviceKey) {
      return NextResponse.json(
        { error: `Unsupported image model: ${imageModel}. Available: ${Object.keys(IMAGE_MODELS).join(", ")}` },
        { status: 400 }
      );
    }
    // One image is generated per call, so one unit is charged. (Pricing by the caller's num_outputs let a negative
    // or fractional value cut the price to the 100-sat floor, and it was never forwarded anyway.)
    const units = 1;

    let cost;
    try {
      cost = await getServiceCostSats(serviceKey, units);
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
      const keyRate = await checkRateLimit(`key:${client.key}`, 60_000, 60);
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

      const result = await refundOnFail(client.user_id, effectiveCostSats, `api_call:${serviceKey}`, () => generateImage({
        prompt,
        model: imageModel,
        width,
        height,
        
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
    const result = await releaseOnFail(verification.txid!, () => generateImage({
      prompt,
      model: imageModel,
      width,
      height,
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
    return errorResponse(err, "Image generation error");
  }
}
