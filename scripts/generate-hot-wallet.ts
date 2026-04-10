/**
 * Generate a fresh BSV mainnet hot wallet for BSVAPI payment receipts.
 *
 * Prints WIF and P2PKH address to stdout. Does NOT persist the WIF —
 * copy it into .env.local as:
 *
 *     BSVAPI_HOT_WALLET_WIF=<wif>
 *     BSVAPI_HOT_WALLET_ADDRESS=<address>
 *
 * Usage:
 *     pnpm tsx scripts/generate-hot-wallet.ts
 *
 * The key is only held in memory during the run. After you copy it,
 * nothing on disk has it except your own .env.local.
 */

import { PrivateKey } from "@bsv/sdk";

function main() {
  const pk = PrivateKey.fromRandom();
  const wif = pk.toWif();
  const address = pk.toAddress();
  const publicKeyHex = pk.toPublicKey().toString();

  const banner = "=".repeat(68);
  console.log("");
  console.log(banner);
  console.log("  BSVAPI Hot Wallet — generated");
  console.log(banner);
  console.log("");
  console.log("  Address:     " + address);
  console.log("  Public key:  " + publicKeyHex);
  console.log("");
  console.log("  WIF (secret — do NOT paste this anywhere public):");
  console.log("  " + wif);
  console.log("");
  console.log(banner);
  console.log("");
  console.log("  Copy these two lines into bsvapi/.env.local:");
  console.log("");
  console.log("    BSVAPI_HOT_WALLET_WIF=" + wif);
  console.log("    BSVAPI_HOT_WALLET_ADDRESS=" + address);
  console.log("");
  console.log(banner);
  console.log("");
  console.log(
    "  Fund the address with a small amount (e.g. 10,000 sats) so the\n" +
      "  treasury has something to spend later; payments from users go\n" +
      "  here automatically once the server is running with these env vars.",
  );
  console.log("");
}

main();
