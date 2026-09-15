/**
 * The Studio's side of the assistant relay (netlify/functions/studio-assistant).
 *
 * The browser composes the whole conversation and sends it with the
 * scientist's Pavlovia sign-in; the function checks the sign-in, adds the
 * model key and relays. The reply is the model's message: content blocks
 * (text, tool_use, and thinking blocks that must go back verbatim on the
 * next call) and the stop reason.
 */
import { getAuthConfig } from "../../../threshold/preprocess/auth/config";
import { GitLabOAuthClient } from "../../../threshold/preprocess/auth/gitlabOAuthClient";
import { getEasyEyesBaseUrl } from "../../../threshold/components/easyeyesBaseUrl";

export const ASSISTANT_ENDPOINT = "/.netlify/functions/studio-assistant";
export const ASSISTANT_PROTOCOL_VERSION = 1;

export interface TextBlock {
  type: "text";
  text: string;
}
export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}
export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}
/** Thinking (and any future) blocks: opaque, passed back unchanged. */
export interface OpaqueBlock {
  type: string;
  [key: string]: unknown;
}
export type ContentBlock =
  | TextBlock
  | ToolUseBlock
  | ToolResultBlock
  | OpaqueBlock;

export interface ApiMessage {
  role: "user" | "assistant";
  content: ContentBlock[];
}

export interface ModelReply {
  content: ContentBlock[];
  stop_reason: string | null;
  usage: { input_tokens?: number; output_tokens?: number } | null;
  model: string | null;
}

export interface AssistantCall {
  system: unknown[];
  messages: ApiMessage[];
  tools: unknown[];
  maxTokens?: number;
  /** "fast": a thought-free, low-effort round (the hedge and the retry). */
  mode?: "fast";
}

/** A live Pavlovia access token, refreshed if needed. Throws when signed out. */
export async function getPavloviaToken(): Promise<string> {
  const config = getAuthConfig();
  const client = GitLabOAuthClient.loadFromStorage(
    config.clientId,
    config.redirectUri,
  );
  if (!client)
    throw new Error("Sign in on the Compiler tab to use the assistant.");
  await client.ensureValidToken();
  return client.getAccessToken();
}

export async function callAssistant(
  call: AssistantCall,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<ModelReply> {
  const pavloviaToken = await getPavloviaToken();
  const response = await fetchImpl(
    `${await getEasyEyesBaseUrl()}${ASSISTANT_ENDPOINT}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        protocolVersion: ASSISTANT_PROTOCOL_VERSION,
        pavloviaToken,
        system: call.system,
        messages: call.messages,
        tools: call.tools,
        maxTokens: call.maxTokens,
        ...(call.mode ? { mode: call.mode } : {}),
      }),
      signal,
    },
  );
  let body: any = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok)
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : `The assistant service answered ${response.status}.`,
    );
  if (!body || !Array.isArray(body.content))
    throw new Error("The assistant returned an unexpected reply.");
  return {
    content: body.content,
    stop_reason: body.stop_reason ?? null,
    usage: body.usage ?? null,
    model: body.model ?? null,
  };
}

/**
 * How long a round may run before a fast round is started beside it. A
 * round that thinks normally answers in 5–15 s; past this the model is
 * usually deep in a long think that could hit the relay's 55 s limit.
 */
export const HEDGE_AFTER_MS = 15_000;

type Settled = { ok: true; reply: ModelReply } | { ok: false; error: unknown };

const settle = (p: Promise<ModelReply>): Promise<Settled> =>
  p.then(
    (reply) => ({ ok: true, reply }) as Settled,
    (error) => ({ ok: false, error }) as Settled,
  );

/** An AbortController that also aborts when `parent` does. */
const child = (parent?: AbortSignal): AbortController => {
  const c = new AbortController();
  if (parent?.aborted) c.abort();
  else parent?.addEventListener("abort", () => c.abort(), { once: true });
  return c;
};

/**
 * One model round with a hedge against slow thinking.
 *
 * The relay (a Netlify function) has a hard 60 s wall, and a round that the
 * model chooses to think long about can run into it. Because the Studio's
 * tools are deterministic, a thought-free "fast" round gives an equally
 * usable answer in a few seconds — so if the normal round has not answered
 * after `hedgeAfterMs`, a fast round starts beside it and the first reply
 * wins (the other is aborted). Errors before the hedge fires (sign-in, rate
 * limit, Stop) are final; a normal round that fails after the hedge fires is
 * covered by the fast one. Costs a second, cheap (cache-read) call only on
 * slow rounds.
 */
export async function callAssistantHedged(
  call: AssistantCall,
  signal?: AbortSignal,
  options: {
    hedgeAfterMs?: number;
    /** Called once, when the fast round starts. */
    onHedge?: () => void;
    callImpl?: typeof callAssistant;
  } = {},
): Promise<ModelReply> {
  const hedgeAfterMs = options.hedgeAfterMs ?? HEDGE_AFTER_MS;
  const callImpl = options.callImpl ?? callAssistant;
  const primaryAbort = child(signal);
  const hedgeAbort = child(signal);
  const primary = settle(callImpl(call, primaryAbort.signal));

  let timer: ReturnType<typeof setTimeout> | undefined;
  const hedgeTime = new Promise<"hedge-time">((resolve) => {
    timer = setTimeout(() => resolve("hedge-time"), hedgeAfterMs);
  });
  const first = await Promise.race([primary, hedgeTime]);
  clearTimeout(timer);
  if (first !== "hedge-time") {
    if (first.ok) return first.reply;
    throw first.error;
  }
  if (signal?.aborted) {
    const s = await primary;
    if (s.ok) return s.reply;
    throw s.error;
  }

  options.onHedge?.();
  const hedge = settle(callImpl({ ...call, mode: "fast" }, hedgeAbort.signal));
  const tagged = <W extends string>(who: W, p: Promise<Settled>) =>
    p.then((s) => ({ who, s }));
  const second = await Promise.race([
    tagged("primary", primary),
    tagged("hedge", hedge),
  ]);
  if (second.s.ok) {
    (second.who === "primary" ? hedgeAbort : primaryAbort).abort();
    return second.s.reply;
  }
  const third = await (second.who === "primary" ? hedge : primary);
  if (third.ok) return third.reply;
  // Both failed: the normal round's error is the one to show.
  throw second.who === "primary" ? second.s.error : third.error;
}
