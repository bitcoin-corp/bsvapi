import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-black/80 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/images/bsvapi-logo.png"
              alt="BSVAPI"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="font-bold text-lg tracking-tight">BSVAPI</span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <a
              href="#how-it-works"
              className="text-zinc-400 hover:text-white transition-colors"
            >
              How It Works
            </a>
            <a
              href="#pricing"
              className="text-zinc-400 hover:text-white transition-colors"
            >
              Pricing
            </a>
            <a
              href="#docs"
              className="text-zinc-400 hover:text-white transition-colors"
            >
              Docs
            </a>
            <a
              href="/admin"
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Admin
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-16 overflow-hidden">
        {/* Background video */}
        <div className="absolute inset-0 z-0">
          <video
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover opacity-30"
          >
            <source src="https://b0ase.com/images/clientprojects/bsvapi-com/BSV_API.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-32 md:py-44">
          {/* Banner image */}
          <div className="mb-10 max-w-2xl">
            <Image
              src="/images/BSVAPI_02.jpg"
              alt="BSV API"
              width={762}
              height={229}
              className="rounded-2xl border border-zinc-800/50 shadow-2xl shadow-orange-500/10"
              priority
            />
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6">
            Money in.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-500">
              Content out.
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-zinc-400 max-w-2xl mb-10 leading-relaxed">
            The API vending machine. Pay per call with BSV micropayments.
            No accounts. No subscriptions. No API keys. Just HTTP.
          </p>

          <div className="flex flex-wrap gap-4">
            <a
              href="#docs"
              className="group px-8 py-4 bg-gradient-to-r from-orange-500 to-yellow-500 text-black font-bold rounded-xl hover:from-orange-400 hover:to-yellow-400 transition-all shadow-lg shadow-orange-500/25"
            >
              Start Building
              <span className="ml-2 group-hover:ml-3 transition-all">→</span>
            </a>
            <a
              href="#how-it-works"
              className="px-8 py-4 border border-zinc-700 rounded-xl hover:border-orange-500/50 hover:bg-orange-500/5 transition-all"
            >
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-zinc-800 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <div className="text-3xl font-bold text-orange-400">402</div>
            <div className="text-sm text-zinc-500 mt-1">
              HTTP Payment Required
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold">0</div>
            <div className="text-sm text-zinc-500 mt-1">
              Accounts needed
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold">2×</div>
            <div className="text-sm text-zinc-500 mt-1">
              Simple markup pricing
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-orange-400">BSV</div>
            <div className="text-sm text-zinc-500 mt-1">
              Micropayments only
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-4xl font-bold mb-4">How It Works</h2>
          <p className="text-zinc-400 mb-16 max-w-xl">
            Like a vending machine. You don&apos;t create an account at a vending
            machine. You put money in and product comes out.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="relative group">
              <div className="absolute -inset-px bg-gradient-to-b from-orange-500/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative border border-zinc-800 rounded-2xl p-8 h-full bg-zinc-950">
                <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center mb-6">
                  <span className="text-2xl font-bold text-orange-400">1</span>
                </div>
                <h3 className="text-xl font-semibold mb-3">Send Your Request</h3>
                <p className="text-zinc-400 leading-relaxed">
                  POST to our API. Same OpenAI-compatible format you already
                  know. Any model, any prompt.
                </p>
                <div className="mt-6 bg-black rounded-xl p-4 font-mono text-xs text-zinc-400">
                  <span className="text-orange-400">POST</span>{" "}
                  /api/v1/chat/completions
                </div>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute -inset-px bg-gradient-to-b from-orange-500/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative border border-zinc-800 rounded-2xl p-8 h-full bg-zinc-950">
                <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center mb-6">
                  <span className="text-2xl font-bold text-orange-400">2</span>
                </div>
                <h3 className="text-xl font-semibold mb-3">Get The Price</h3>
                <p className="text-zinc-400 leading-relaxed">
                  We respond with HTTP 402 and the exact cost in satoshis. Your
                  client pays the BSV transaction automatically.
                </p>
                <div className="mt-6 bg-black rounded-xl p-4 font-mono text-xs text-zinc-400">
                  <span className="text-yellow-400">402</span> Payment Required
                  <br />
                  <span className="text-zinc-600">x-bsv-payment-satoshis:</span>{" "}
                  <span className="text-orange-400">5000</span>
                </div>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute -inset-px bg-gradient-to-b from-orange-500/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative border border-zinc-800 rounded-2xl p-8 h-full bg-zinc-950">
                <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center mb-6">
                  <span className="text-2xl font-bold text-orange-400">3</span>
                </div>
                <h3 className="text-xl font-semibold mb-3">Get Your Content</h3>
                <p className="text-zinc-400 leading-relaxed">
                  Payment verified on-chain. Request proxied to the AI model.
                  Response returned. Done. No strings attached.
                </p>
                <div className="mt-6 bg-black rounded-xl p-4 font-mono text-xs text-zinc-400">
                  <span className="text-green-400">200</span> OK
                  <br />
                  <span className="text-zinc-600">{`{`}</span>{" "}
                  <span className="text-orange-400">&quot;choices&quot;</span>: [...]
                  <span className="text-zinc-600">{` }`}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Vending Machine */}
      <section className="py-24 border-t border-zinc-800 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-4">
                The $402 Philosophy
              </div>
              <h2 className="text-4xl font-bold mb-6 leading-tight">
                We build vending machines.
              </h2>
              <p className="text-lg text-zinc-400 leading-relaxed mb-6">
                The HTTP 402 status code — &quot;Payment Required&quot; — has been
                reserved since 1997 but never used. Until now.
              </p>
              <p className="text-lg text-zinc-400 leading-relaxed mb-6">
                BSVAPI is a vending machine for AI. Put BSV in, get intelligence
                out. No relationship needed. No contract. No subscription. No
                identity. The transaction is the only thing that matters.
              </p>
              <p className="text-zinc-500 leading-relaxed">
                Built on{" "}
                <span className="text-zinc-300">BRC-0105</span> — the BSV
                standard for HTTP service monetization. Compatible with{" "}
                <span className="text-zinc-300">PacketPay</span> clients for
                automatic payment handling.
              </p>
            </div>
            <div className="border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-500/50" />
                <span className="text-xs text-zinc-500 ml-2 font-mono">
                  terminal
                </span>
              </div>
              <pre className="p-6 text-sm font-mono text-zinc-400 overflow-x-auto leading-relaxed">
                <code>
{`$ curl -X POST bsvapi.com/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{"model":"grok-3-mini","messages":[
    {"role":"user","content":"What is BSV?"}
  ]}'

`}<span className="text-yellow-400">{`< HTTP/1.1 402 Payment Required`}</span>{`
`}<span className="text-zinc-600">{`< x-bsv-payment-satoshis-required: 500`}</span>{`

`}<span className="text-zinc-500"># Pay 500 sats, retry with txid</span>{`

$ curl -X POST bsvapi.com/api/v1/chat/completions \\
  -H "x-bsv-payment: abc123...def" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"grok-3-mini","messages":[
    {"role":"user","content":"What is BSV?"}
  ]}'

`}<span className="text-green-400">{`< HTTP/1.1 200 OK`}</span>{`
`}<span className="text-orange-400">{`{
  "choices": [{
    "message": {
      "content": "Bitcoin SV (BSV) is..."
    }
  }],
  "payment": {
    "txid": "abc123...def",
    "satoshisPaid": 500
  }
}`}</span>
                </code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 border-t border-zinc-800">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-4xl font-bold mb-4">Pricing</h2>
          <p className="text-zinc-400 mb-12">
            2× upstream cost. No hidden fees. No minimum. Pay exactly for what
            you use.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="border border-zinc-800 rounded-2xl p-8 bg-zinc-950 hover:border-orange-500/30 transition-colors">
              <h3 className="font-mono text-lg font-bold mb-1">grok-3</h3>
              <p className="text-sm text-zinc-500 mb-6">
                Most capable Grok model
              </p>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Input</span>
                  <span className="font-mono text-orange-400">
                    $6.00 / 1M tokens
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Output</span>
                  <span className="font-mono text-orange-400">
                    $30.00 / 1M tokens
                  </span>
                </div>
              </div>
            </div>

            <div className="border-2 border-orange-500/50 rounded-2xl p-8 bg-zinc-950 relative">
              <div className="absolute -top-3 left-6 bg-orange-500 text-black text-xs font-bold px-3 py-1 rounded-full">
                BEST VALUE
              </div>
              <h3 className="font-mono text-lg font-bold mb-1">grok-3-mini</h3>
              <p className="text-sm text-zinc-500 mb-6">
                Fast and affordable
              </p>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Input</span>
                  <span className="font-mono text-orange-400">
                    $0.60 / 1M tokens
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Output</span>
                  <span className="font-mono text-orange-400">
                    $1.00 / 1M tokens
                  </span>
                </div>
              </div>
            </div>

            <div className="border border-zinc-800 rounded-2xl p-8 bg-zinc-950 hover:border-orange-500/30 transition-colors">
              <h3 className="font-mono text-lg font-bold mb-1">grok-2</h3>
              <p className="text-sm text-zinc-500 mb-6">
                Previous generation
              </p>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Input</span>
                  <span className="font-mono text-orange-400">
                    $4.00 / 1M tokens
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Output</span>
                  <span className="font-mono text-orange-400">
                    $20.00 / 1M tokens
                  </span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-sm text-zinc-500 mt-6">
            Prices in USD equivalent. You pay in BSV at current exchange rate.
            Use{" "}
            <code className="text-orange-400/80 bg-zinc-900 px-2 py-0.5 rounded">
              POST /api/v1/price
            </code>{" "}
            to get exact satoshi cost before calling.
          </p>
        </div>
      </section>

      {/* Two Access Modes */}
      <section className="py-24 border-t border-zinc-800 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-4xl font-bold mb-12">Two Ways to Pay</h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="border border-zinc-800 rounded-2xl p-8">
              <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center mb-6 text-2xl">
                ₿
              </div>
              <h3 className="text-xl font-bold mb-3">Anonymous BSV</h3>
              <p className="text-zinc-400 mb-4">
                No account needed. Pay per call with a BSV transaction. We
                verify on-chain and serve the response.
              </p>
              <ul className="space-y-2 text-sm text-zinc-500">
                <li className="flex items-center gap-2">
                  <span className="text-orange-400">✓</span> Zero friction
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-orange-400">✓</span> No data stored
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-orange-400">✓</span> Blockchain receipt
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-orange-400">✓</span> Full price (2×)
                </li>
              </ul>
            </div>

            <div className="border border-orange-500/30 rounded-2xl p-8 bg-orange-500/5">
              <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center mb-6 text-2xl">
                🔑
              </div>
              <h3 className="text-xl font-bold mb-3">API Key</h3>
              <p className="text-zinc-400 mb-4">
                For businesses and power users. Get an API key, calls are
                metered and invoiced monthly in BSV.
              </p>
              <ul className="space-y-2 text-sm text-zinc-500">
                <li className="flex items-center gap-2">
                  <span className="text-orange-400">✓</span> Usage dashboard
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-orange-400">✓</span> Volume discounts
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-orange-400">✓</span> Mates&apos; rates
                  available
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-orange-400">✓</span> Monthly BSV
                  invoicing
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Docs */}
      <section id="docs" className="py-24 border-t border-zinc-800">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-4xl font-bold mb-4">Quick Start</h2>
          <p className="text-zinc-400 mb-12">Three endpoints. That&apos;s it.</p>

          <div className="space-y-8">
            {/* Models */}
            <div className="border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="bg-zinc-900 px-6 py-4 border-b border-zinc-800 flex items-center gap-3">
                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-mono font-bold rounded">
                  GET
                </span>
                <code className="text-sm">/api/v1/models</code>
                <span className="text-xs text-zinc-500 ml-auto">Free</span>
              </div>
              <pre className="p-6 text-sm font-mono text-zinc-400">
                {`curl https://bsvapi.com/api/v1/models`}
              </pre>
            </div>

            {/* Price */}
            <div className="border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="bg-zinc-900 px-6 py-4 border-b border-zinc-800 flex items-center gap-3">
                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-mono font-bold rounded">
                  POST
                </span>
                <code className="text-sm">/api/v1/price</code>
                <span className="text-xs text-zinc-500 ml-auto">Free</span>
              </div>
              <pre className="p-6 text-sm font-mono text-zinc-400 overflow-x-auto">
                {`curl -X POST https://bsvapi.com/api/v1/price \\
  -H "Content-Type: application/json" \\
  -d '{"model":"grok-3-mini","messages":[{"role":"user","content":"Hello"}]}'`}
              </pre>
            </div>

            {/* Chat Completions */}
            <div className="border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="bg-zinc-900 px-6 py-4 border-b border-zinc-800 flex items-center gap-3">
                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-mono font-bold rounded">
                  POST
                </span>
                <code className="text-sm">/api/v1/chat/completions</code>
                <span className="text-xs text-zinc-500 ml-auto">
                  BSV payment or API key
                </span>
              </div>
              <pre className="p-6 text-sm font-mono text-zinc-400 overflow-x-auto">
                {`# With API key (registered clients):
curl -X POST https://bsvapi.com/api/v1/chat/completions \\
  -H "Authorization: Bearer bsvapi_sk_npgx_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"grok-3-mini","messages":[{"role":"user","content":"Hello"}]}'

# With BSV payment (anonymous):
curl -X POST https://bsvapi.com/api/v1/chat/completions \\
  -H "x-bsv-payment: <txid>" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"grok-3-mini","messages":[{"role":"user","content":"Hello"}]}'`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t border-zinc-800 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to build?
          </h2>
          <p className="text-xl text-zinc-400 mb-10 max-w-xl mx-auto">
            No signup form. No onboarding email. Just start making requests.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="#docs"
              className="px-8 py-4 bg-gradient-to-r from-orange-500 to-yellow-500 text-black font-bold rounded-xl hover:from-orange-400 hover:to-yellow-400 transition-all shadow-lg shadow-orange-500/25"
            >
              Read the Docs
            </a>
            <a
              href="https://bitcoin-corp.com"
              className="px-8 py-4 border border-zinc-700 rounded-xl hover:border-orange-500/50 transition-all"
            >
              Bitcoin Corporation →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Image
              src="/images/bsvapi-logo.png"
              alt="BSVAPI"
              width={24}
              height={24}
              className="rounded"
            />
            <span className="text-sm text-zinc-500">
              A{" "}
              <a
                href="https://bitcoin-corp.com"
                className="text-orange-400 hover:text-orange-300"
              >
                Bitcoin Corporation
              </a>{" "}
              service
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <span>BRC-0105 compatible</span>
            <span>·</span>
            <span>BSV micropayments</span>
            <span>·</span>
            <span>OpenAI-compatible API</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
