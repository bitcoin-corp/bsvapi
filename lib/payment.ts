import crypto from "crypto";
import { isTxidUsed, recordTxid } from "./db";

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

export function createPaymentRequirement(
  satoshis: number
): PaymentRequirement {
  return {
    version: "1",
    satoshisRequired: satoshis,
    derivationPrefix: crypto.randomBytes(16).toString("hex"),
    network: "mainnet",
  };
}

export function paymentHeaders(
  req: PaymentRequirement
): Record<string, string> {
  return {
    "x-bsv-payment-version": req.version,
    "x-bsv-payment-satoshis-required": req.satoshisRequired.toString(),
    "x-bsv-payment-derivation-prefix": req.derivationPrefix,
    "x-bsv-payment-network": req.network,
  };
}

/**
 * Verify a BSV payment. Checks WhatsOnChain for tx existence and value.
 * Uses persistent DB for replay protection.
 */
export async function verifyPayment(
  paymentHeader: string | null,
  requiredSatoshis: number
): Promise<PaymentVerification> {
  if (!paymentHeader) {
    return { valid: false, error: "No payment provided" };
  }

  try {
    let txid: string;
    try {
      const parsed = JSON.parse(paymentHeader);
      txid = parsed.txid;
    } catch {
      txid = paymentHeader.trim();
    }

    if (!txid || txid.length !== 64) {
      return { valid: false, error: "Invalid txid format" };
    }

    // Check replay
    if (await isTxidUsed(txid)) {
      return { valid: false, error: "Transaction already used" };
    }

    // Verify on-chain
    const res = await fetch(
      `https://api.whatsonchain.com/v1/bsv/main/tx/${txid}`
    );

    if (!res.ok) {
      return { valid: false, error: "Transaction not found on-chain" };
    }

    const tx = await res.json();

    const totalOutputSats =
      tx.vout?.reduce(
        (sum: number, out: { value: number }) =>
          sum + Math.round(out.value * 1e8),
        0
      ) || 0;

    if (totalOutputSats < requiredSatoshis) {
      return {
        valid: false,
        error: `Insufficient payment: ${totalOutputSats} sats < ${requiredSatoshis} required`,
      };
    }

    // Mark as used
    await recordTxid(txid);

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
