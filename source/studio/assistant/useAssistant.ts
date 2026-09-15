/**
 * The assistant conversation: one hook that owns the transcript and runs
 * the tool loop.
 *
 * A turn: the scientist's text (plus the current studio_state) goes to the
 * model; while the model answers with tool calls, each is executed here
 * (tools.ts), its result appended, and the model called again — until it
 * answers in prose, asks the scientist something (ask_user pauses the loop
 * and the next message answers it), errors, is cancelled, or hits the round
 * cap. Every table change is applied to the grid as it happens, so the
 * scientist watches the table fill in; the state before the turn is kept so
 * one click reverts the whole turn.
 *
 * The transcript sent to the model (Anthropic Messages format) is separate
 * from the chat items shown, and is truncated back to the turn's start on
 * error or cancel, so it never holds a tool_use without its tool_result.
 */
import { useCallback, useRef, useState } from "react";
import type { TableState } from "../tableModel";
import {
  callAssistantHedged,
  type ApiMessage,
  type ContentBlock,
  type ToolResultBlock,
  type ToolUseBlock,
} from "./api";
import { studioStateBlock, systemBlocks } from "./prompt";
import {
  ASSISTANT_TOOLS,
  runTool,
  tableOutline,
  type AssistantContext,
  type ToolReport,
} from "./tools";
import { existsInUserResources } from "../resources";
import type { EasyEyesError } from "../validation";

export const MAX_TOOL_ROUNDS = 16;

export interface UndoState {
  before: TableState;
  beforeName: string;
  done: boolean;
}

/**
 * What a turn did to the study, for the result card under the reply: the
 * table's shape, every edit, the compiler's final verdict, files it still
 * needs, and — for a build — why the values are what they are.
 */
export interface TurnResult {
  kind: "built" | "edited";
  title: string;
  steps: string[];
  rationale: string[];
  changed: string[];
  blocks: { block: string; conditions: string[] }[];
  conditionCount: number;
  parameterCount: number;
  errors: EasyEyesError[];
  warnings: EasyEyesError[];
  /** Resource files the table names that are not in EasyEyesResources. */
  missing: string[];
  /** Files named but unverifiable (signed out). */
  unverified: string[];
}

/** Folds one tool's report into the turn's running result. */
function foldReport(
  acc: TurnResult | null,
  r: ToolReport,
  table: TableState,
  ctx: AssistantContext,
): TurnResult {
  const missing: string[] = [];
  const unverified: string[] = [];
  for (const n of r.check.needed) {
    const present =
      existsInUserResources(n, ctx.userResources) ||
      ctx.droppedFileNames.includes(n.filename);
    if (present) continue;
    (ctx.signedIn ? missing : unverified).push(n.filename);
  }
  const built = r.kind === "built" || acc?.kind === "built";
  return {
    kind: built ? "built" : "edited",
    title: r.kind === "built" ? r.title : acc?.title ?? r.title,
    steps: [...(r.kind === "built" ? [] : acc?.steps ?? []), ...r.steps],
    rationale: r.kind === "built" ? r.rationale : acc?.rationale ?? [],
    changed: [...new Set([...(acc?.changed ?? []), ...r.changed])],
    blocks: tableOutline(table),
    conditionCount: table.conditionCount,
    parameterCount: table.rows.length,
    errors: r.check.errors.filter((e) => e.kind === "error"),
    warnings: r.check.errors.filter((e) => e.kind === "warning"),
    missing,
    unverified,
  };
}

/** Every item is stamped when it appears, so the log can show timings. */
interface ItemBase {
  id: number;
  at: number;
}

export type ChatItem = ItemBase &
  (
    | { kind: "user"; text: string }
    | {
        kind: "assistant";
        text: string;
        undo?: UndoState;
        /** Set on the reply that closes a turn which changed the study. */
        result?: TurnResult;
      }
    | {
        kind: "activity";
        text: string;
        /** What the tool answered the model (compiler checks, lookups…). */
        detail?: string;
        failed?: boolean;
      }
    | {
        kind: "question";
        text: string;
        options: string[];
        answered: boolean;
      }
    | { kind: "error"; text: string }
  );

/** Omit that keeps a union a union (a plain Omit collapses it). */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;
type NewItem = DistributiveOmit<ChatItem, "id" | "at">;

interface PendingAsk {
  toolUseId: string;
  /** Results of the other tools in the same model message, sent together. */
  priorResults: ToolResultBlock[];
  questionItemId: number;
}

export interface AssistantHost {
  /** The Studio's live state, read at the start of each model call. */
  getContext: () => AssistantContext;
  /**
   * Put a tool's table on the grid. `reveal` = the table was built anew
   * (build_study): the grid fills in cell by cell instead of flashing rows.
   */
  applyTable: (
    table: TableState,
    changedParams: string[],
    reveal?: boolean,
  ) => void;
  applyName: (name: string) => void;
  /** Select a parameter's row in the grid and flash it (result-card chips). */
  focusParameter?: (name: string) => void;
}

let nextItemId = 1;

const textOf = (content: ContentBlock[]): string =>
  content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

const toolUsesOf = (content: ContentBlock[]): ToolUseBlock[] =>
  content.filter((b): b is ToolUseBlock => b.type === "tool_use");

export function useAssistant(host: AssistantHost) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [busy, setBusy] = useState(false);
  const [pendingAsk, setPendingAsk] = useState<PendingAsk | null>(null);
  const apiMessages = useRef<ApiMessage[]>([]);
  const abort = useRef<AbortController | null>(null);
  /** Notes for the model about things done outside the chat (reverts). */
  const notes = useRef<string[]>([]);
  const hostRef = useRef(host);
  hostRef.current = host;

  const push = useCallback((item: NewItem): number => {
    const id = nextItemId++;
    setItems((old) => [...old, { ...item, id, at: Date.now() } as ChatItem]);
    return id;
  }, []);

  const patch = useCallback(
    (id: number, change: (item: ChatItem) => ChatItem) =>
      setItems((old) => old.map((it) => (it.id === id ? change(it) : it))),
    [],
  );

  /**
   * Runs model rounds until the model stops calling tools (or asks the
   * scientist). When the turn changed the table, the closing assistant item
   * gets the undo state.
   */
  const runLoop = useCallback(
    async (undo: UndoState, signal: AbortSignal): Promise<void> => {
      let changed = false;
      let lastAssistantItem: number | null = null;
      let result: TurnResult | null = null;
      // The table as the tools have left it, ahead of React's re-render.
      let table = hostRef.current.getContext().table;

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const reply = await callAssistantHedged(
          {
            system: systemBlocks(),
            messages: apiMessages.current,
            tools: ASSISTANT_TOOLS as unknown as unknown[],
            // Room for the model's (adaptive) thinking plus a full reply.
            maxTokens: 8192,
          },
          signal,
        );
        const text = textOf(reply.content);
        if (text) lastAssistantItem = push({ kind: "assistant", text });

        const uses = toolUsesOf(reply.content);
        const continuing = uses.length > 0 && reply.stop_reason === "tool_use";
        // Thinking blocks and all: the assistant message goes back verbatim —
        // except tool_use blocks that will get no result (a reply cut off by
        // max_tokens), which the API would reject on the next call.
        const kept = continuing
          ? reply.content
          : reply.content.filter((b) => b.type !== "tool_use");
        if (kept.length)
          apiMessages.current.push({ role: "assistant", content: kept });
        if (!continuing) break;

        const results: ToolResultBlock[] = [];
        let ask: {
          toolUseId: string;
          question: string;
          options: string[];
        } | null = null;
        for (const use of uses) {
          if (ask) {
            // Tools after a question wait for the answer; tell the model so.
            results.push({
              type: "tool_result",
              tool_use_id: use.id,
              content: "Not run: ask the scientist first, then call again.",
              is_error: true,
            });
            continue;
          }
          const ctx = { ...hostRef.current.getContext(), table };
          const outcome = runTool(use.name, use.input ?? {}, ctx);
          if (outcome.table) {
            table = outcome.table;
            changed = true;
            hostRef.current.applyTable(
              outcome.table,
              outcome.changedParams ?? [],
              outcome.reveal === true,
            );
            if (outcome.report)
              result = foldReport(result, outcome.report, table, ctx);
          }
          if (outcome.name !== undefined)
            hostRef.current.applyName(outcome.name);
          if (outcome.ask) {
            ask = { toolUseId: use.id, ...outcome.ask };
            continue;
          }
          push({
            kind: "activity",
            text: outcome.activity,
            detail: outcome.result,
            failed: outcome.isError,
          });
          results.push({
            type: "tool_result",
            tool_use_id: use.id,
            content: outcome.result,
            ...(outcome.isError ? { is_error: true } : {}),
          });
        }

        if (ask) {
          const questionItemId = push({
            kind: "question",
            text: ask.question,
            options: ask.options,
            answered: false,
          });
          setPendingAsk({
            toolUseId: ask.toolUseId,
            priorResults: results,
            questionItemId,
          });
          break;
        }

        apiMessages.current.push({ role: "user", content: results });
        if (round === MAX_TOOL_ROUNDS - 1)
          push({
            kind: "error",
            text: `Stopped after ${MAX_TOOL_ROUNDS} steps. Say “continue” to let the assistant go on.`,
          });
      }

      if (changed) {
        const target =
          lastAssistantItem ?? push({ kind: "assistant", text: "" });
        const final = result;
        patch(target, (it) =>
          it.kind === "assistant"
            ? { ...it, undo: { ...undo }, ...(final ? { result: final } : {}) }
            : it,
        );
      }
    },
    [push, patch],
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      const ctx = hostRef.current.getContext();
      const undo: UndoState = {
        before: ctx.table,
        beforeName: ctx.name,
        done: false,
      };
      const startLength = apiMessages.current.length;

      push({ kind: "user", text: trimmed });
      if (pendingAsk) {
        patch(pendingAsk.questionItemId, (it) =>
          it.kind === "question" ? { ...it, answered: true } : it,
        );
        apiMessages.current.push({
          role: "user",
          content: [
            ...pendingAsk.priorResults,
            {
              type: "tool_result",
              tool_use_id: pendingAsk.toolUseId,
              content: trimmed,
            },
          ],
        });
        setPendingAsk(null);
      } else {
        const noteText = notes.current.length
          ? `\n\nNotes: ${notes.current.join(" ")}`
          : "";
        notes.current = [];
        apiMessages.current.push({
          role: "user",
          content: [
            { type: "text", text: trimmed + noteText },
            { type: "text", text: studioStateBlock(ctx) },
          ],
        });
      }

      const controller = new AbortController();
      abort.current = controller;
      setBusy(true);
      try {
        await runLoop(undo, controller.signal);
      } catch (e) {
        // Leave the transcript consistent: nothing from this turn survives.
        apiMessages.current.length = startLength;
        setPendingAsk(null);
        if (!controller.signal.aborted)
          push({
            kind: "error",
            text: e instanceof Error ? e.message : "The assistant failed.",
          });
        else push({ kind: "activity", text: "Stopped." });
      } finally {
        abort.current = null;
        setBusy(false);
      }
    },
    [busy, pendingAsk, push, patch, runLoop],
  );

  const cancel = useCallback(() => abort.current?.abort(), []);

  const undoTurn = useCallback(
    (itemId: number) => {
      const it = itemsRef.current.find((x) => x.id === itemId);
      if (!it || it.kind !== "assistant" || !it.undo || it.undo.done) return;
      hostRef.current.applyTable(it.undo.before, []);
      hostRef.current.applyName(it.undo.beforeName);
      notes.current.push(
        "The scientist reverted the table changes from your previous turn; the studio_state below is current.",
      );
      patch(itemId, (x) =>
        x.kind === "assistant" && x.undo
          ? { ...x, undo: { ...x.undo, done: true } }
          : x,
      );
    },
    [patch],
  );

  const reset = useCallback(() => {
    abort.current?.abort();
    apiMessages.current = [];
    notes.current = [];
    setPendingAsk(null);
    setItems([]);
  }, []);

  return {
    items,
    busy,
    /** The open question, if the assistant is waiting for an answer. */
    pendingQuestion: pendingAsk
      ? (items.find((it) => it.id === pendingAsk.questionItemId) as
          | Extract<ChatItem, { kind: "question" }>
          | undefined) ?? null
      : null,
    send,
    cancel,
    undoTurn,
    reset,
    focusParameter: (name: string) => hostRef.current.focusParameter?.(name),
  };
}
