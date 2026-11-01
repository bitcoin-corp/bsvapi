// Home in the bwalletx.com/family style (owner, 1 Nov 2026): family fonts and gold, live model list from the router.
import { MODELS, ALIASES, listChatModels } from "@/lib/router";
import { getSupportedServices } from "@/lib/pricing";

const MARKUP = parseFloat(process.env.MARKUP_MULTIPLIER || "2");
const usd = (n: number) => (n === 0 ? "free" : `$${n.toFixed(n < 1 ? 2 : 2)}`);

const ALIAS_WHAT: Record<string, string> = {
  "b/chat": "Everyday chat",
  "b/fast": "Quick, cheap replies",
  "b/smart": "Harder questions",
};

const STATUS: Array<[boolean, string]> = [
  [true, "Pay per call in BSV with HTTP 402: no account needed"],
  [true, "Chat, images, video, music and transcription"],
  [true, "Task names (b/chat, b/fast, b/smart) with automatic fallback"],
  [true, "API keys with credits for businesses; failed calls refunded"],
  [false, "Sign in with bWalletX"],
  [false, "Self-service deposits and a usage dashboard per project"],
];

function Code({ children }: { children: string }) {
  return <pre className="code">{children}</pre>;
}

export default function Home() {
  const live = new Set(listChatModels().map((m) => m.id));
  const chat = MODELS.filter((m) => live.has(m.id));
  const aliases = Object.keys(ALIASES).filter((a) => live.has(a));
  const services = getSupportedServices();
  return (
    <div className="fam">
      <nav className="top">
        <div className="wrap row">
          <a href="/" className="brand">
            <span className="sq" />
            <span>
              BSV<i>API</i>
            </span>
          </a>
          <div className="links">
            <a href="#models">Models</a>
            <a href="#how">How it works</a>
            <a href="#reference">Docs</a>
            <a href="/login" className="pill">
              Sign in
            </a>
          </div>
        </div>
      </nav>

      <header className="wrap hero">
        <p className="kicker">HTTP 402 · Payment Required</p>
        <h1>
          AI, paid by
          <span>the call in BSV.</span>
        </h1>
        <p className="lede">
          Chat, images, video, music and transcription through one OpenAI-compatible API. Pay a few satoshis per call.
          No card. No account needed.
        </p>
        <div className="row gap">
          <a className="btn" href="#reference">
            Read the docs
          </a>
          <a className="btn ghost" href="#models">
            See the models
          </a>
        </div>
      </header>

      <section id="models" className="wrap sec">
        <h2>Models</h2>
        <p className="sub">Ask for a task name and BSVAPI picks the model, falling back to another if one is down.</p>
        <div className="cards">
          {aliases.map((a) => (
            <div className="card" key={a}>
              <code className="tag">{a}</code>
              <b>{ALIAS_WHAT[a] ?? a}</b>
              <span>{ALIASES[a].filter((id) => live.has(id)).join(" → ")}</span>
            </div>
          ))}
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Chat model</th>
              <th>Input / 1M tokens</th>
              <th>Output / 1M tokens</th>
            </tr>
          </thead>
          <tbody>
            {chat.map((m) => (
              <tr key={m.id}>
                <td>
                  <code>{m.id}</code>
                </td>
                <td>{usd(m.input * MARKUP)}</td>
                <td>{usd(m.output * MARKUP)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="tbl">
          <thead>
            <tr>
              <th>Service</th>
              <th>What it does</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id}>
                <td>
                  <code>{s.id}</code>
                </td>
                <td>{s.description}</td>
                <td>{usd(s.usdPerUnit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="fine">
          Prices in US dollars, paid in BSV at the current rate, with a minimum per call. Get the exact price in
          satoshis first with <code>POST /api/v1/price</code>.
        </p>
      </section>

      <section id="how" className="wrap sec">
        <h2>How it works</h2>
        <div className="steps">
          <div className="card">
            <span className="n">1</span>
            <b>Ask</b>
            <span>Send your request. BSVAPI answers 402 with the price in satoshis and the address to pay.</span>
          </div>
          <div className="card">
            <span className="n">2</span>
            <b>Pay</b>
            <span>Pay that address from bWalletX or any BSV wallet, then resend with the txid in x-bsv-payment.</span>
          </div>
          <div className="card">
            <span className="n">3</span>
            <b>Get your answer</b>
            <span>The payment is checked on chain and your answer comes back with a receipt. A failed call can be retried with the same payment.</span>
          </div>
        </div>
        <Code>{`POST /api/v1/chat/completions
{"model":"b/chat","messages":[{"role":"user","content":"Hello"}]}

← 402 Payment Required
← x-bsv-payment-satoshis-required: 500

POST /api/v1/chat/completions
x-bsv-payment: <txid>

← 200 OK  { "choices": [...], "payment": { "txid": "…", "satoshisPaid": 500 } }`}</Code>
      </section>

      <section className="wrap sec">
        <h2>For businesses</h2>
        <p className="sub">
          Registered clients get an API key, prepaid credits in BSV and volume discounts. Calls that fail upstream are
          refunded, and chat is charged on actual usage.
        </p>
        <Code>{`POST /api/v1/chat/completions
Authorization: Bearer bsvapi_sk_yourcompany_xxx
{"model":"b/smart","messages":[...]}`}</Code>
      </section>

      <section id="reference" className="wrap sec">
        <h2>Reference</h2>
        <div className="ref">
          <div>
            <code className="verb">GET</code> <code>/api/v1/models</code>
            <span>List models, task names and services. Free.</span>
          </div>
          <div>
            <code className="verb">POST</code> <code>/api/v1/price</code>
            <span>Price a request in satoshis before you call it. Free.</span>
          </div>
          <div>
            <code className="verb">POST</code> <code>/api/v1/chat/completions</code>
            <span>OpenAI-compatible chat, streaming supported.</span>
          </div>
          <div>
            <code className="verb">POST</code> <code>/api/v1/images/generate</code>
            <span>Images.</span>
          </div>
          <div>
            <code className="verb">POST</code> <code>/api/v1/video/generate</code>
            <span>Video.</span>
          </div>
          <div>
            <code className="verb">POST</code> <code>/api/v1/music/generate</code>
            <span>Music.</span>
          </div>
          <div>
            <code className="verb">POST</code> <code>/api/v1/transcriptions</code>
            <span>Speech to text.</span>
          </div>
        </div>
        <p className="fine">Implements BRC-105 HTTP Service Monetization; works with PacketPay clients.</p>
      </section>

      <section className="wrap sec">
        <h2>What works today</h2>
        <ul className="status">
          {STATUS.map(([ok, text]) => (
            <li key={text}>
              <span className={ok ? "st live" : "st"}>{ok ? "Live" : "Not open yet"}</span>
              {text}
            </li>
          ))}
        </ul>
      </section>

      <footer className="wrap foot">
        BSVAPI is part of the <a href="https://bwalletx.com/family">bWalletX family</a>. Questions:{" "}
        <a href="mailto:support@bwalletx.com">support@bwalletx.com</a>
      </footer>
    </div>
  );
}
