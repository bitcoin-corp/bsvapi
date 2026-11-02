/**
 * Generate a fresh BSV mainnet hot wallet for BSVAPI payment receipts.
 *
 * Prints WIF and P2PKH address to stdout. Does NOT persist the WIF.
 * The server only needs the address:
 *
 *     BSVAPI_HOT_WALLET_ADDRESS=<address>
 *
 * Keep the WIF offline (password manager / hardware backup). The server
 * never reads it, so it never needs to sit in a deployed env.
 *
 * Usage:
 *     pnpm tsx scripts/generate-hot-wallet.ts
 *
 * The key is only held in memory during the run.
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
  console.log("  Put the address in the server env (.env.local or your host):");
  console.log("");
  console.log("    BSVAPI_HOT_WALLET_ADDRESS=" + address);
  console.log("");
  console.log("  Store the WIF offline. The server does not need it.");
  console.log("");
  console.log(banner);
  console.log("");
  console.log(
    "  Payments from callers land at this address once the server is\n" +
      "  running with BSVAPI_HOT_WALLET_ADDRESS set.",
  );
  console.log("");
}

main();
