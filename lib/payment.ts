import { claimTxid, isTxidUsed, releaseTxid } from "./db";

/**
 * Run the upstream call for a payment verifyPayment has already claimed. If it throws, the txid is released so the
 * payer can retry with the same payment instead of paying twice (the "user paid, upstream 500'd" case).
 */
export async function releaseOnFail<T>(txid: string, call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (err) {
    await releaseTxid(txid).catch(() => {});
    throw err;
  }
}

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
  // Trim whitespace and newlines: when the env var is set via CLI
  // with `echo | vercel env add` the trailing newline leaks in and
  // causes Array.includes checks on scriptPubKey.addresses to miss.
  const addr = (process.env.BSVAPI_HOT_WALLET_ADDRESS ?? "").trim();
  if (addr.length === 0) {
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
    console.error("verifyPayment:", err);
    return { valid: false, error: "Payments are not configured on this server" };
  }

  try {
    let txid: string;
    try {
      const parsed = JSON.parse(paymentHeader);
      txid = parsed.txid;
    } catch {
      txid = paymentHeader.trim();
    }
    if (typeof txid === "string") txid = txid.toLowerCase();

    if (typeof txid !== "string" || !/^[0-9a-fA-F]{64}$/.test(txid)) {
      return { valid: false, error: "Invalid txid format" };
    }

    // Replay protection
    if (await isTxidUsed(txid)) {
      return { valid: false, error: "Transaction already used" };
    }

    // Fetch the transaction from WhatsOnChain. Clients often pay via
    // ARC (GorillaPool / Taal) and retry immediately, but WoC's
    // indexer can lag a few seconds behind the relay network. We
    // retry the lookup a few times before giving up so the happy
    // path works end-to-end without the client having to know about
    // indexer propagation.
    const retryDelays = [1500, 2500, 4000];
    let tx: { vout?: Array<Record<string, unknown>> } | null = null;
    for (let i = 0; i <= retryDelays.length; i++) {
      if (i > 0) {
        await new Promise((r) => setTimeout(r, retryDelays[i - 1]));
      }
      const res = await fetch(
        `https://api.whatsonchain.com/v1/bsv/main/tx/${txid}`,
      );
      if (res.ok) {
        tx = await res.json();
        break;
      }
      if (res.status !== 404) {
        return {
          valid: false,
          error: `WhatsOnChain lookup failed: ${res.status}`,
        };
      }
    }
    if (!tx) {
      return { valid: false, error: "Transaction not found on-chain" };
    }

    const paidToHotWallet = sumOutputsToAddress(tx, hotWalletAddress);
    if (paidToHotWallet < requiredSatoshis) {
      return {
        valid: false,
        error:
          `Insufficient payment to ${hotWalletAddress}: ` +
          `${paidToHotWallet} sats < ${requiredSatoshis} required`,
      };
    }

    // Claim the txid atomically now, after the amount checks out. The route runs its upstream call through
    // releaseOnFail, which gives the txid back if the call throws, so a failed call stays retryable.
    if (!(await claimTxid(txid))) {
      return { valid: false, error: "Transaction already used" };
    }

    return {
      valid: true,
      txid,
      satoshisPaid: paidToHotWallet,
    };
  } catch (err) {
    console.error("verifyPayment:", err);
    return { valid: false, error: "Payment verification failed, try again" };
  }
}

