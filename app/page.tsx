import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <Image
              src="/images/bsvapi-logo.png"
              alt="BSVAPI"
              width={24}
              height={24}
            />
            <span className="font-semibold text-sm">BSVAPI</span>
          </a>
          <div className="flex items-center gap-5 text-sm text-zinc-500">
            <a href="#protocol" className="hover:text-zinc-900">
              Protocol
            </a>
            <a href="#pricing" className="hover:text-zinc-900">
              Pricing
            </a>
            <a href="#reference" className="hover:text-zinc-900">
              Reference
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16">
        <p className="text-sm text-zinc-400 font-mono mb-6">
          HTTP 402 Payment Required
        </p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.15] mb-6">
          Pay for API calls
          <br />
          with Bitcoin SV
        </h1>
        <p className="text-lg text-zinc-500 max-w-lg mb-10 leading-relaxed">
          No accounts. No subscriptions. Send a request, pay in satoshis, get
          your response. OpenAI-compatible endpoints backed by Grok.
        </p>
        <div className="flex gap-3">
          <a
            href="#reference"
            className="px-5 py-2.5 bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800"
          >
            API Reference
          </a>
          <a
            href="#protocol"
            className="px-5 py-2.5 text-sm font-medium border border-zinc-300 hover:border-zinc-400"
          >
            How it works
          </a>
        </div>
      </section>

      {/* Banner */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <Image
          src="/images/BSVAPI_02.jpg"
          alt="BSV API"
          width={762}
          height={229}
          className="w-full"
          priority
        />
      </section>

      {/* Protocol */}
      <section id="protocol" className="border-t border-zinc-200">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-2xl font-bold mb-3">Protocol</h2>
          <p className="text-zinc-500 mb-12 max-w-lg">
            BSVAPI uses HTTP 402 for payment negotiation. The flow is three
            requests, or two if you already know the price.
          </p>

          <div className="space-y-10">
            {/* Step 1 */}
            <div className="grid md:grid-cols-[140px_1fr] gap-4">
              <div>
                <p className="text-sm font-mono text-zinc-400">Step 1</p>
                <p className="text-sm font-medium mt-1">Request</p>
              </div>
              <div>
                <p className="text-sm text-zinc-600 mb-3">
                  Send your request without payment. The server responds with
                  402 and the price in satoshis.
                </p>
                <pre className="bg-zinc-50 border border-zinc-200 p-4 text-xs font-mono text-zinc-600 overflow-x-auto">
{`POST /api/v1/chat/completions
Content-Type: application/json

{"model":"grok-3-mini","messages":[{"role":"user","content":"Hello"}]}

← 402 Payment Required
← x-bsv-payment-satoshis-required: 500`}
                </pre>
              </div>
            </div>

            {/* Step 2 */}
            <div className="grid md:grid-cols-[140px_1fr] gap-4">
              <div>
                <p className="text-sm font-mono text-zinc-400">Step 2</p>
                <p className="text-sm font-medium mt-1">Pay</p>
              </div>
              <div>
                <p className="text-sm text-zinc-600 mb-3">
                  Create a BSV transaction for the required amount. Include the
                  txid in the{" "}
                  <code className="text-zinc-900 bg-zinc-100 px-1">
                    x-bsv-payment
                  </code>{" "}
                  header.
                </p>
                <pre className="bg-zinc-50 border border-zinc-200 p-4 text-xs font-mono text-zinc-600 overflow-x-auto">
{`POST /api/v1/chat/completions
Content-Type: application/json
x-bsv-payment: a1b2c3d4e5f6...

{"model":"grok-3-mini","messages":[{"role":"user","content":"Hello"}]}`}
                </pre>
              </div>
            </div>

            {/* Step 3 */}
            <div className="grid md:grid-cols-[140px_1fr] gap-4">
              <div>
                <p className="text-sm font-mono text-zinc-400">Step 3</p>
                <p className="text-sm font-medium mt-1">Receive</p>
              </div>
              <div>
                <p className="text-sm text-zinc-600 mb-3">
                  Payment is verified on-chain. The request is proxied upstream.
                  You get the response with a payment receipt.
                </p>
                <pre className="bg-zinc-50 border border-zinc-200 p-4 text-xs font-mono text-zinc-600 overflow-x-auto">
{`← 200 OK

{
  "choices": [{
    "message": {"role":"assistant","content":"Hello! How can I..."}
  }],
  "usage": {"prompt_tokens":12,"completion_tokens":84},
  "payment": {"txid":"a1b2c3...","satoshisPaid":500}
}`}
                </pre>
              </div>
            </div>
          </div>

          <div className="mt-12 border-l-2 border-zinc-200 pl-4">
            <p className="text-sm text-zinc-500">
              Implements{" "}
              <span className="text-zinc-700">BRC-0105</span> HTTP Service
              Monetization. Compatible with{" "}
              <span className="text-zinc-700">PacketPay</span> clients for
              automatic payment handling.
            </p>
          </div>
        </div>
      </section>

      {/* Registered Clients */}
      <section className="border-t border-zinc-200 bg-zinc-50">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-2xl font-bold mb-3">For businesses</h2>
          <p className="text-zinc-500 mb-8 max-w-lg">
            Registered clients get an API key, metered usage, and volume
            discounts. Calls are invoiced monthly in BSV.
          </p>

          <pre className="bg-white border border-zinc-200 p-4 text-xs font-mono text-zinc-600 overflow-x-auto mb-8">
{`POST /api/v1/chat/completions
Authorization: Bearer bsvapi_sk_yourcompany_xxx
Content-Type: application/json

{"model":"grok-3","messages":[{"role":"user","content":"..."}]}

← 200 OK  (no payment header needed — metered to your account)`}
          </pre>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-400 border-b border-zinc-200">
                <th className="pb-2 font-medium">Tier</th>
                <th className="pb-2 font-medium">Discount</th>
                <th className="pb-2 font-medium">Billing</th>
              </tr>
            </thead>
            <tbody className="text-zinc-600">
              <tr className="border-b border-zinc-100">
                <td className="py-2.5">Internal</td>
                <td className="py-2.5">50%</td>
                <td className="py-2.5">Monthly BSV invoice</td>
              </tr>
              <tr className="border-b border-zinc-100">
                <td className="py-2.5">Partner</td>
                <td className="py-2.5">25%</td>
                <td className="py-2.5">Monthly BSV invoice</td>
              </tr>
              <tr>
                <td className="py-2.5">External</td>
                <td className="py-2.5">0%</td>
                <td className="py-2.5">Monthly BSV invoice</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-zinc-200">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-2xl font-bold mb-3">Pricing</h2>
          <p className="text-zinc-500 mb-8">
            2x upstream cost. Paid in BSV at the current exchange rate.
          </p>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-400 border-b border-zinc-200">
                <th className="pb-2 font-medium">Model</th>
                <th className="pb-2 font-medium text-right">Input</th>
                <th className="pb-2 font-medium text-right">Output</th>
              </tr>
            </thead>
            <tbody className="font-mono text-zinc-700">
              <tr className="border-b border-zinc-100">
                <td className="py-3">grok-3</td>
                <td className="py-3 text-right">$6.00 / 1M</td>
                <td className="py-3 text-right">$30.00 / 1M</td>
              </tr>
              <tr className="border-b border-zinc-100">
                <td className="py-3">grok-3-mini</td>
                <td className="py-3 text-right">$0.60 / 1M</td>
                <td className="py-3 text-right">$1.00 / 1M</td>
              </tr>
              <tr>
                <td className="py-3">grok-2</td>
                <td className="py-3 text-right">$4.00 / 1M</td>
                <td className="py-3 text-right">$20.00 / 1M</td>
              </tr>
            </tbody>
          </table>

          <p className="text-xs text-zinc-400 mt-4">
            Use <code className="font-mono">POST /api/v1/price</code> to get
            the exact cost in satoshis before calling.
          </p>
        </div>
      </section>

      {/* API Reference */}
      <section id="reference" className="border-t border-zinc-200 bg-zinc-50">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-2xl font-bold mb-8">Reference</h2>

          <div className="space-y-8">
            <div>
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-xs font-mono font-medium text-zinc-400">
                  GET
                </span>
                <code className="text-sm font-mono">/api/v1/models</code>
              </div>
              <p className="text-sm text-zinc-500 mb-3">
                List available models. No authentication required.
              </p>
              <pre className="bg-white border border-zinc-200 p-4 text-xs font-mono text-zinc-600">
{`curl https://bsvapi.com/api/v1/models`}
              </pre>
            </div>

            <div>
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-xs font-mono font-medium text-zinc-400">
                  POST
                </span>
                <code className="text-sm font-mono">/api/v1/price</code>
              </div>
              <p className="text-sm text-zinc-500 mb-3">
                Get a price estimate in satoshis. No authentication required.
              </p>
              <pre className="bg-white border border-zinc-200 p-4 text-xs font-mono text-zinc-600 overflow-x-auto">
{`curl -X POST https://bsvapi.com/api/v1/price \\
  -H "Content-Type: application/json" \\
  -d '{"model":"grok-3-mini","messages":[{"role":"user","content":"Hello"}]}'`}
              </pre>
            </div>

            <div>
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-xs font-mono font-medium text-zinc-400">
                  POST
                </span>
                <code className="text-sm font-mono">
                  /api/v1/chat/completions
                </code>
              </div>
              <p className="text-sm text-zinc-500 mb-3">
                OpenAI-compatible chat completions. Requires BSV payment or API
                key.
              </p>
              <pre className="bg-white border border-zinc-200 p-4 text-xs font-mono text-zinc-600 overflow-x-auto">
{`# Anonymous (BSV payment)
curl -X POST https://bsvapi.com/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "x-bsv-payment: <txid>" \\
  -d '{"model":"grok-3-mini","messages":[{"role":"user","content":"Hello"}]}'

# Registered client (API key)
curl -X POST https://bsvapi.com/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer bsvapi_sk_yourcompany_xxx" \\
  -d '{"model":"grok-3-mini","messages":[{"role":"user","content":"Hello"}]}'`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-8">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between text-xs text-zinc-400">
          <span>
            A{" "}
            <a
              href="https://bitcoin-corp.com"
              className="text-zinc-600 hover:text-zinc-900"
            >
              Bitcoin Corporation
            </a>{" "}
            service
          </span>
          <span className="font-mono">BRC-0105</span>
        </div>
      </footer>
    </div>
  );
}
