import type { ChatCompletionRequest, ChatCompletionResponse } from "../grok";

/** One OpenAI-compatible upstream (xAI, OpenRouter, Anthropic's OpenAI-compatible endpoint). */
export interface Upstream {
  id: "xai" | "openrouter" | "anthropic";
  baseUrl: string;
  key: string;
  extraHeaders?: Record<string, string>;
}

/** Upstream failure with its HTTP status, so the router can tell "try another" from "the answer is no". */
export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly provider: string
  ) {
    super(message);
  }
}

async function post(up: Upstream, body: object): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${up.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${up.key}`, ...up.extraHeaders },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new UpstreamError(`${up.id} unreachable: ${err instanceof Error ? err.message : err}`, 0, up.id);
  }
  if (!res.ok) throw new UpstreamError(`${up.id} error (${res.status}): ${await res.text()}`, res.status, up.id);
  return res;
}

const bodyFor = (r: ChatCompletionRequest, upstreamModel: string, stream: boolean) => ({
  model: upstreamModel,
  messages: r.messages,
  temperature: r.temperature,
  max_tokens: r.max_tokens,
  stream,
});

export async function chat(up: Upstream, r: ChatCompletionRequest, upstreamModel: string): Promise<ChatCompletionResponse> {
  return (await post(up, bodyFor(r, upstreamModel, false))).json();
}

export async function chatStream(
  up: Upstream,
  r: ChatCompletionRequest,
  upstreamModel: string
): Promise<{ stream: ReadableStream; response: Response }> {
  const res = await post(up, bodyFor(r, upstreamModel, true));
  if (!res.body) throw new UpstreamError("No stream body returned", 502, up.id);
  return { stream: res.body, response: res };
}
