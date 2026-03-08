/**
 * BRC-0105 HTTP Service Monetization — Simplified Implementation
 *
 * Flow:
 * 1. Client sends request without payment
 * 2. Server responds 402 with x-bsv-payment-satoshis-required + derivation prefix
 * 3. Client constructs BSV tx paying that amount, sends in x-bsv-payment header
 * 4. Server verifies tx and processes request
 *
 * For MVP, we verify the transaction exists and pays sufficient amount
 * using WhatsOnChain API. Full BRC-0105 with mutual auth (BRC-103) comes later.
 */

import crypto from "crypto";

export interface PaymentRequirement {
  version: string;
  satoshisRequired: number;
  derivationPrefix: string;
  network: string;
}

export interface PaymentVerification {
  valid: boolean;
  txid?: string;
  satoshisPaid?: number;
  error?: string;
}

/**
 * Generate a 402 Payment Required response with BRC-0105 headers.
 */
export function createPaymentRequirement(satoshis: number): PaymentRequirement {
  return {
    version: "1",
    satoshisRequired: satoshis,
    derivationPrefix: crypto.randomBytes(16).toString("hex"),
    network: "mainnet",
  };
}

/**
 * Build 402 response headers from a payment requirement.
 */
export function paymentHeaders(req: PaymentRequirement): Record<string, string> {
  return {
    "x-bsv-payment-version": req.version,
    "x-bsv-payment-satoshis-required": req.satoshisRequired.toString(),
    "x-bsv-payment-derivation-prefix": req.derivationPrefix,
    "x-bsv-payment-network": req.network,
  };
}

/**
 * Verify a BSV payment from the x-bsv-payment header.
 *
 * MVP approach: Accept raw txid or tx hex.
 * Verify via WhatsOnChain that the tx exists and outputs >= required amount.
 *
 * TODO: Full BRC-0105 verification with SPV proof, derivation prefix matching,
 * and double-spend protection.
 */
export async function verifyPayment(
  paymentHeader: string | null,
  requiredSatoshis: number
): Promise<PaymentVerification> {
  if (!paymentHeader) {
    return { valid: false, error: "No payment provided" };
  }

  try {
    // For MVP: accept a JSON payload with txid
    // Format: { "txid": "abc123...", "vout": 0 }
    // Or simply a raw txid string
    let txid: string;

    try {
      const parsed = JSON.parse(paymentHeader);
      txid = parsed.txid;
    } catch {
      // Assume raw txid
      txid = paymentHeader.trim();
    }

    if (!txid || txid.length !== 64) {
      return { valid: false, error: "Invalid txid format" };
    }

    // Verify tx exists on-chain via WhatsOnChain
    const res = await fetch(
      `https://api.whatsonchain.com/v1/bsv/main/tx/${txid}`
    );

    if (!res.ok) {
      return { valid: false, error: "Transaction not found on-chain" };
    }

    const tx = await res.json();

    // Sum all outputs to find total value
    // In production, we'd check specific output addresses match our derivation
    const totalOutputSats = tx.vout?.reduce(
      (sum: number, out: { value: number }) => sum + Math.round(out.value * 1e8),
      0
    ) || 0;

    if (totalOutputSats < requiredSatoshis) {
      return {
        valid: false,
        error: `Insufficient payment: ${totalOutputSats} sats < ${requiredSatoshis} required`,
      };
    }

    return {
      valid: true,
      txid,
      satoshisPaid: totalOutputSats,
    };
  } catch (err) {
    return {
      valid: false,
      error: `Payment verification failed: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}

// Track used derivation prefixes to prevent replay attacks
const usedPrefixes = new Set<string>();
const MAX_PREFIX_CACHE = 10000;

export function markPrefixUsed(prefix: string): void {
  usedPrefixes.add(prefix);
  // Evict old entries if cache is too large
  if (usedPrefixes.size > MAX_PREFIX_CACHE) {
    const first = usedPrefixes.values().next().value;
    if (first) usedPrefixes.delete(first);
  }
}

export function isPrefixUsed(prefix: string): boolean {
  return usedPrefixes.has(prefix);
}
