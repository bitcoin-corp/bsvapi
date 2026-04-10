import { isTxidUsed, recordTxid } from "./db";

/**
 * BSVAPI x402 payment requirement.
 *
 * The server's 402 response tells the client exactly where to send
 * their BSV (the hot wallet address) and how much is required. The
 * client constructs a payment transaction whose outputs include at
 * least `satoshisRequired` flowing to `payToAddress`, broadcasts it,
 * and retries the original request with the resulting txid in the
 * `x-bsv-payment` header.
 *
 * Prior versions of this file sent a random `derivationPrefix` that
 * the verification path never consulted and did not advertise a
 * receiving address at all, which meant a caller could claim a
 * payment by sending any transaction with enough total output value
 * to ANY address. That hole is closed here by requiring the hot
 * wallet address to appear in the payment tx.
 */

export interface PaymentRequirement {
  version: string;
  satoshisRequired: number;
  /** P2PKH mainnet address the client must pay to */
  payToAddress: string;
  network: string;
}

export interface PaymentVerification {
  valid: boolean;
  txid?: string;
  satoshisPaid?: number;
  error?: string;
}

/**
 * The server-operated hot wallet address where all x402 payments
 * must land. Loaded from BSVAPI_HOT_WALLET_ADDRESS. If unset, the
 * server refuses to issue payment requirements — it is better to
 * 500 than to advertise an unusable payment flow.
 */
function getHotWalletAddress(): string {
  const addr = process.env.BSVAPI_HOT_WALLET_ADDRESS;
  if (!addr || addr.length === 0) {
    throw new Error(
      "BSVAPI_HOT_WALLET_ADDRESS is not set — generate a wallet via " +
        "scripts/generate-hot-wallet.ts and copy the address into .env.local",
    );
  }
  return addr;
}

export function createPaymentRequirement(
  satoshis: number,
): PaymentRequirement {
  return {
    version: "2",
    satoshisRequired: satoshis,
    payToAddress: getHotWalletAddress(),
    network: "mainnet",
  };
}

export function paymentHeaders(
  req: PaymentRequirement,
): Record<string, string> {
  return {
    "x-bsv-payment-version": req.version,
    "x-bsv-payment-satoshis-required": req.satoshisRequired.toString(),
    "x-bsv-payment-address": req.payToAddress,
    "x-bsv-payment-network": req.network,
  };
}

/**
 * Given a WhatsOnChain transaction response, sum all outputs whose
 * scriptPubKey resolves to the hot wallet address. Returns zero if
 * none of the outputs target the address.
 *
 * WhatsOnChain's tx response shape:
 *   { vout: [{ value: 0.0001, scriptPubKey: { addresses: ["1..."] } }, ...] }
 * Values are in BSV (not sats) and need to be scaled.
 */
function sumOutputsToAddress(
  tx: { vout?: Array<Record<string, unknown>> },
  address: string,
): number {
  let total = 0;
  for (const out of tx.vout ?? []) {
    const value = typeof out.value === "number" ? out.value : 0;
    const scriptPubKey = out.scriptPubKey as
      | { addresses?: string[]; addressType?: string }
      | undefined;
    const addresses = scriptPubKey?.addresses ?? [];
    if (addresses.includes(address)) {
      total += Math.round(value * 1e8);
    }
  }
  return total;
}

/**
 * Verify a BSV payment. Checks WhatsOnChain for tx existence,
 * confirms at least `requiredSatoshis` of output value is directed
 * at the hot wallet address, and records the txid so the same
 * payment cannot be spent twice against this API.
 */
export async function verifyPayment(
  paymentHeader: string | null,
  requiredSatoshis: number,
): Promise<PaymentVerification> {
  if (!paymentHeader) {
    return { valid: false, error: "No payment provided" };
  }

  let hotWalletAddress: string;
  try {
    hotWalletAddress = getHotWalletAddress();
  } catch (err) {
    return {
      valid: false,
      error:
        err instanceof Error
          ? err.message
          : "Hot wallet address is not configured",
    };
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

    // Replay protection
    if (await isTxidUsed(txid)) {
      return { valid: false, error: "Transaction already used" };
    }

    // Fetch the transaction from WhatsOnChain. The response lives in
    // a mempool state for up to a few minutes before confirmation;
    // we accept unconfirmed txs so long as they resolve in WoC.
    const res = await fetch(
      `https://api.whatsonchain.com/v1/bsv/main/tx/${txid}`,
    );

    if (!res.ok) {
      return { valid: false, error: "Transaction not found on-chain" };
    }

    const tx = await res.json();

    const paidToHotWallet = sumOutputsToAddress(tx, hotWalletAddress);
    if (paidToHotWallet < requiredSatoshis) {
      return {
        valid: false,
        error:
          `Insufficient payment to ${hotWalletAddress}: ` +
          `${paidToHotWallet} sats < ${requiredSatoshis} required`,
      };
    }

    await recordTxid(txid);

    return {
      valid: true,
      txid,
      satoshisPaid: paidToHotWallet,
    };
  } catch (err) {
    return {
      valid: false,
      error: `Payment verification failed: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}

