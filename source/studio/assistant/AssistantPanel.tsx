/**
 * The assistant's pane: a raised white pill at the bottom right of the
 * Studio (the EasyEyes mark + "Assistant") opens a full-height side pane
 * along the right edge. Native to the Studio — same type and tokens as the
 * rest of the panel (assistant.css).
 *
 * The transcript is a lab log, not a chat: each request is an entry with a
 * time, the steps the assistant took run as a timeline under it (each one
 * opens to show what the compiler answered), and the reply follows with how
 * long the turn took. The pane is resizable — drag its left edge, or widen
 * it from the header — and remembers its width.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  useAssistant,
  type AssistantHost,
  type ChatItem,
  type TurnResult,
} from "./useAssistant";
import { EasyEyesLogo } from "./EasyEyesLogo";
import { RichText } from "./RichText";
import { letterToValueIndex, type GridFocus, type ToolFile } from "./tools";
import { MENU_SKILLS, runMessage, skillById } from "./skills";
import {
  ACCEPT,
  ACCEPTED_DESCRIPTION,
  MAX_CONVERSATION_BYTES,
  MAX_FILES_PER_MESSAGE,
  attachFile,
  formatBytes,
  releaseAttachment,
  totalBytes,
  type Attachment,
} from "./attachments";
import "./assistant.css";

/**
 * Teaching callout over the trigger ("New — describe your study…"). Kept
 * but switched off until there is a real moment to show it.
 */
const NUDGE_ENABLED = false;
const NUDGE_DELAY_MS = 1800;

/** Pane width: default, drag limits, the "widen" toggle, and where it is kept. */
const WIDTH_DEFAULT = 400;
const WIDTH_MIN = 340;
const WIDTH_WIDE = 680;
const WIDTH_MAX = 960;
/** Room the grid must keep, so the pane cannot swallow the Studio. */
const STUDIO_MIN_VISIBLE = 240;
const WIDTH_KEY = "easyeyes-studio-assistant-width";

const clampWidth = (w: number): number =>
  Math.round(
    Math.max(
      WIDTH_MIN,
      Math.min(w, WIDTH_MAX, window.innerWidth - STUDIO_MIN_VISIBLE),
    ),
  );

const loadWidth = (): number => {
  try {
    const v = Number(window.localStorage.getItem(WIDTH_KEY));
    return v > 0 ? clampWidth(v) : WIDTH_DEFAULT;
  } catch {
    return WIDTH_DEFAULT;
  }
};

const saveWidth = (w: number) => {
  try {
    window.localStorage.setItem(WIDTH_KEY, String(w));
  } catch {
    /* private mode etc. — the width just does not persist */
  }
};

interface Props extends AssistantHost {
  signedIn: boolean;
  /** The row or cell last clicked in the grid — shown in the strip under the header. */
  focus: GridFocus | null;
}

/**
 * Three example requests, shown in full above the composer until the first
 * message. Most new users try these, so each is a complete study that the
 * builder produces in one round, compile-clean: a bare one-liner (the
 * recipe's standard layout), a low-contrast acuity study on a
 * color-managed display, and a fully specified multi-block crowding study
 * with a questionnaire.
 */
const SUGGESTIONS: string[] = [
  "Can you set up a crowding experiment in the periphery?",
  "I'd like to measure letter acuity at low contrast on a high-precision display: three contrasts, at the fovea and 5 deg right, and ask afterwards whether the faintest letters were visible.",
  "Could you build a Sloan letter crowding study with radial flankers at 5 and 10 deg, left and right, plus a tangential condition at 10 deg right? 35 trials each, one block per side. Ask age, glasses and dominant eye first, and calibrate screen size and track viewing distance with the webcam.",
];

/** Empty-state mark: a spreadsheet with the EasyEyes eye on a badge. */
function HeroMark() {
  return (
    <div className="asst-hero-mark" aria-hidden="true">
      <svg viewBox="0 0 96 72" width="96" height="72" fill="none">
        <rect
          x="4"
          y="6"
          width="70"
          height="52"
          rx="6"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <path
          d="M4 22h70M4 40h70M28 6v52M51 6v52"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <rect
          x="6"
          y="8"
          width="66"
          height="12"
          rx="4"
          fill="currentColor"
          opacity="0.12"
        />
      </svg>
      <span className="asst-hero-badge">
        <EasyEyesLogo size={30} />
      </span>
    </div>
  );
}

/** Header icon: arrows out (widen) or in (narrow). */
function WidthIcon({ wide }: { wide: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        d={
          wide
            ? "M1.5 8h13M4 5l3 3-3 3M12 5 9 8l3 3" // heads point inward: narrow
            : "M2 8h12M5 5 2 8l3 3M11 5l3 3-3 3" // heads point outward: widen
        }
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Skills pill: a slash, as in the "/code" trigger. */
function SkillsIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M10.2 2.5 5.8 13.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Attach files (the clip in the composer). */
function AttachIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
      <path
        d="M10.8 5.2 6.3 9.7a1.4 1.4 0 0 0 2 2l5-5a2.9 2.9 0 0 0-4.1-4.1L3.9 7.9a4.3 4.3 0 0 0 6.1 6.1l3.6-3.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The small clip before an attached file's name in a sent message. */
const PaperclipIcon = () => <AttachIcon size={12} />;

function Chevron({ dir }: { dir: "down" | "right" | "left" }) {
  const d =
    dir === "down"
      ? "M4 6.5 8 10.5l4-4"
      : dir === "right"
      ? "M6.5 4 10.5 8l-4 4"
      : "M9.5 4 5.5 8l4 4";
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The skills menu, from the composer's Skills pill (or a "/" typed in an
 * empty box). Two levels: the list of skills, and a secondary panel for the
 * chosen one — what it does, its trigger, and Run, which submits the skill's
 * prompt (or the draft) at once. With room (a wide pane) the panel opens
 * beside the list as a flyout, following the pointer; in a narrow pane it
 * takes the list's place, with a way back.
 */
function SkillsMenu({
  flyout,
  onRun,
  onClose,
}: {
  flyout: boolean;
  onRun: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(
    flyout ? MENU_SKILLS[0]?.id ?? null : null,
  );
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = ref.current;
      if (el && !el.parentElement?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [onClose]);

  const skill = selected ? skillById(selected) : undefined;
  const list = (
    <div className="asst-menu-list" role="menu" aria-label="Skills">
      <div className="asst-menu-head">Skills</div>
      {MENU_SKILLS.map((s) => (
        <button
          key={s.id}
          type="button"
          role="menuitem"
          aria-haspopup="true"
          aria-expanded={selected === s.id}
          className={`asst-menu-item${selected === s.id ? " selected" : ""}`}
          onMouseEnter={() => flyout && setSelected(s.id)}
          onFocus={() => flyout && setSelected(s.id)}
          onClick={() => setSelected(s.id)}
        >
          <span className="asst-menu-item-title">{s.title}</span>
          <Chevron dir="right" />
        </button>
      ))}
    </div>
  );
  const detail = skill && (
    <div className="asst-menu-detail" role="group" aria-label={skill.title}>
      {!flyout && (
        <button
          type="button"
          className="asst-menu-back"
          onClick={() => setSelected(null)}
        >
          <Chevron dir="left" />
          Skills
        </button>
      )}
      <div className="asst-menu-detail-title">{skill.title}</div>
      <p className="asst-menu-detail-text">{skill.summary}</p>
      <div className="asst-menu-detail-foot">
        <code
          className="asst-menu-trigger"
          title="Type this at the start of a message to run the skill on your own question"
        >
          {skill.trigger}
        </code>
        <button
          type="button"
          className="asst-menu-run"
          title="Runs now; anything in the box goes along as your question"
          onClick={() => {
            onClose();
            onRun(skill.id);
          }}
        >
          Run
        </button>
      </div>
    </div>
  );
  return (
    <div className={`asst-menu${flyout ? " flyout" : ""}`} ref={ref}>
      {(flyout || !skill) && list}
      {detail}
    </div>
  );
}

const clock = (at: number): string =>
  new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const seconds = (ms: number): string =>
  ms < 10_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms / 1000)} s`;

type Activity = Extract<ChatItem, { kind: "activity" }>;

/**
 * The log, grouped for display: consecutive steps become one timeline. The
 * request that opened each turn is remembered so replies can show how long
 * the turn took.
 */
type LogGroup =
  | { key: string; type: "item"; item: ChatItem; turnStart: number | null }
  | { key: string; type: "steps"; steps: Activity[] };

const groupItems = (items: ChatItem[]): LogGroup[] => {
  const groups: LogGroup[] = [];
  let turnStart: number | null = null;
  for (const it of items) {
    if (it.kind === "user") turnStart = it.at;
    if (it.kind === "activity") {
      const last = groups[groups.length - 1];
      if (last?.type === "steps") last.steps.push(it);
      else groups.push({ key: `s${it.id}`, type: "steps", steps: [it] });
      continue;
    }
    groups.push({ key: `i${it.id}`, type: "item", item: it, turnStart });
  }
  return groups;
};

function Step({ step }: { step: Activity }) {
  const cls = `asst-step${step.failed ? " failed" : " done"}`;
  if (!step.detail) return <li className={cls}>{step.text}</li>;
  return (
    <li className={cls}>
      <details>
        <summary title="Show what the tool answered">{step.text}</summary>
        <pre className="asst-step-detail">{step.detail}</pre>
      </details>
    </li>
  );
}

const plural = (n: number, word: string): string =>
  `${n} ${word}${n === 1 ? "" : "s"}`;

/** How many chips before the rest folds behind "+N more". */
const CHIP_LIMIT = 12;

/**
 * The result of a turn that changed the study, laid out like a report: the
 * compiler's verdict first, then the study's shape (blocks → conditions),
 * what was changed (chips that jump to the row), the errors verbatim, the
 * files still needed, and — for a build — why the values are what they are.
 */
function ResultCard({
  result,
  onFocus,
}: {
  result: TurnResult;
  onFocus: (name: string) => void;
}) {
  const [allChips, setAllChips] = useState(false);
  const ok = result.errors.length === 0;
  const chips = allChips ? result.changed : result.changed.slice(0, CHIP_LIMIT);
  const showChips = result.kind === "edited" && result.changed.length > 0;
  return (
    <div className={`asst-result${ok ? " ok" : " bad"}`}>
      <div className="asst-result-head">
        <span className="asst-result-status" role="status">
          <span className="asst-result-mark" aria-hidden="true">
            {ok ? "✓" : "!"}
          </span>
          {ok ? "Compiles" : plural(result.errors.length, "compiler error")}
          {result.warnings.length > 0 && (
            <span className="asst-result-warn">
              · {plural(result.warnings.length, "warning")}
            </span>
          )}
        </span>
        <span className="asst-result-title">
          {result.kind === "built" ? result.title : "Edited"}
          <span className="asst-result-meta">
            {" "}
            · {plural(result.conditionCount, "condition")} ·{" "}
            {plural(result.parameterCount, "parameter")}
          </span>
        </span>
      </div>

      {result.blocks.length > 0 && (
        <ol className="asst-blocks" aria-label="Blocks">
          {result.blocks.map((b, i) => (
            <li key={`${b.block}-${i}`} className="asst-block">
              <span className="asst-block-num">Block {b.block}</span>
              <span className="asst-block-conds">
                {b.conditions.map((c, j) => (
                  <span key={j} className="asst-block-cond">
                    {c}
                  </span>
                ))}
                {b.conditions.length > 1 && (
                  <span className="asst-block-note">interleaved</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}

      {result.steps.length > 0 && (
        <ul className="asst-result-steps">
          {result.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}

      {showChips && (
        <div className="asst-result-changed">
          <span className="asst-result-label">Changed</span>
          <span className="asst-chips">
            {chips.map((p) => (
              <button
                key={p}
                type="button"
                className="asst-param-chip"
                onClick={() => onFocus(p)}
                title={`Show ${p} in the grid`}
              >
                {p}
              </button>
            ))}
            {!allChips && result.changed.length > CHIP_LIMIT && (
              <button
                type="button"
                className="asst-param-chip more"
                onClick={() => setAllChips(true)}
              >
                +{result.changed.length - CHIP_LIMIT} more
              </button>
            )}
          </span>
        </div>
      )}

      {result.errors.length > 0 && (
        <ul className="asst-result-errors">
          {result.errors.slice(0, 8).map((e, i) => (
            <li key={i}>
              <span
                className="asst-result-error-msg"
                dangerouslySetInnerHTML={{ __html: e.message }}
              />
              {e.parameters?.length > 0 && (
                <span className="asst-chips">
                  {e.parameters.slice(0, 4).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="asst-param-chip"
                      onClick={() => onFocus(p)}
                      title={`Show ${p} in the grid`}
                    >
                      {p}
                    </button>
                  ))}
                </span>
              )}
            </li>
          ))}
          {result.errors.length > 8 && (
            <li className="asst-result-more">
              … {result.errors.length - 8} more in the Compiler checks
            </li>
          )}
        </ul>
      )}

      {(result.missing.length > 0 || result.unverified.length > 0) && (
        <div className="asst-result-files">
          <span className="asst-result-label">
            {result.missing.length > 0 ? "Missing files" : "Files named"}
          </span>
          <span className="asst-chips">
            {[...result.missing, ...result.unverified].map((f) => (
              <span
                key={f}
                className={`asst-file-chip${
                  result.missing.includes(f) ? " missing" : ""
                }`}
                title={
                  result.missing.includes(f)
                    ? "Not in your EasyEyesResources — upload it before compiling"
                    : "Cannot be checked while signed out"
                }
              >
                {f}
              </span>
            ))}
          </span>
        </div>
      )}

      {result.rationale.length > 0 && (
        <details className="asst-result-why">
          <summary>Why these values</summary>
          <ul>
            {result.rationale.map((r, i) => (
              <li key={i}>
                <RichText text={r} onFocus={onFocus} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Entry({
  item,
  turnStart,
  onUndo,
  onOption,
  onFocus,
}: {
  item: ChatItem;
  turnStart: number | null;
  onUndo: (id: number) => void;
  onOption: (text: string) => void;
  onFocus: (name: string) => void;
}) {
  switch (item.kind) {
    case "user":
      return (
        <div className="asst-entry asst-entry-user">
          <div className="asst-entry-label">
            <span>Request</span>
            <span className="asst-time">{clock(item.at)}</span>
          </div>
          <div className="asst-entry-body">{item.text}</div>
          {item.attachments && item.attachments.length > 0 && (
            <ul className="asst-entry-attachments">
              {item.attachments.map((a, i) => (
                <li key={i} title={`${a.kind} · ${formatBytes(a.bytes)}`}>
                  <PaperclipIcon />
                  {a.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    case "assistant":
      return (
        <div className="asst-entry asst-entry-assistant">
          <div className="asst-entry-label">
            <span>Assistant</span>
            {turnStart !== null && (
              <span className="asst-time" title="Time from request to reply">
                {seconds(item.at - turnStart)}
              </span>
            )}
          </div>
          {item.result && <ResultCard result={item.result} onFocus={onFocus} />}
          {(item.text || !item.result) && (
            <div className="asst-entry-body">
              {item.text ? (
                <RichText text={item.text} onFocus={onFocus} />
              ) : item.undo ? (
                "Applied the changes."
              ) : (
                ""
              )}
            </div>
          )}
          {item.undo && (
            <div className="asst-entry-foot">
              <span className="asst-foot-note">
                {item.undo.done ? "Changes reverted" : "Changed the study"}
              </span>
              <button
                className="asst-undo"
                disabled={item.undo.done}
                onClick={() => onUndo(item.id)}
                title="Put the study back as it was before this reply"
              >
                Revert
              </button>
            </div>
          )}
        </div>
      );
    case "question":
      return (
        <div className="asst-entry asst-entry-question">
          <div className="asst-entry-label">
            <span>Question for you</span>
          </div>
          <div className="asst-entry-body">
            <RichText text={item.text} onFocus={onFocus} />
          </div>
          {!item.answered && item.options.length > 0 && (
            <div className="asst-options">
              {item.options.map((o) => (
                <button
                  key={o}
                  className="asst-option"
                  onClick={() => onOption(o)}
                >
                  {o}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    case "error":
      return (
        <div className="asst-entry asst-entry-error">
          <div className="asst-entry-label">
            <span>Error</span>
          </div>
          <div className="asst-entry-body">{item.text}</div>
        </div>
      );
    case "file":
      return (
        <div className="asst-entry asst-entry-file">
          <div className="asst-entry-label">
            <span>Document</span>
            <span className="asst-time">{clock(item.at)}</span>
          </div>
          <FileCard file={item.file} />
        </div>
      );
    default:
      return null;
  }
}

const DocIcon = () => (
  <svg width="22" height="26" viewBox="0 0 22 26" aria-hidden="true">
    <path
      d="M3 1.5h10l6 6V23a1.5 1.5 0 0 1-1.5 1.5h-14.5A1.5 1.5 0 0 1 1.5 23V3A1.5 1.5 0 0 1 3 1.5z"
      fill="#fff"
      stroke="currentColor"
      strokeWidth="1.4"
    />
    <path d="M13 1.5v6h6" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <path
      d="M5.5 12.5h11M5.5 16h11M5.5 19.5h7"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
  </svg>
);

const kb = (s: string): string => {
  const bytes = new TextEncoder().encode(s).length;
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
};

/** The text of an HTML document's body, for a plain-text clipboard fallback. */
const plainTextOf = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body?.innerText ?? doc.body?.textContent ?? "").trim();
};

/**
 * A document a tool produced: its title and size, Open (a new tab, from
 * which the browser prints to PDF), Copy (with formatting, for Word or
 * Google Docs) and Download; the page itself rendered behind a disclosure
 * so the chat stays short.
 */
export function FileCard({ file }: { file: ToolFile }) {
  const [copied, setCopied] = useState(false);
  const isHtml = file.mime === "text/html";
  const blobUrl = () =>
    URL.createObjectURL(
      new Blob([file.content], { type: `${file.mime};charset=utf-8` }),
    );
  const download = () => {
    const url = blobUrl();
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const open = () => {
    const url = blobUrl();
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  const copy = async () => {
    try {
      if (isHtml && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([file.content], { type: "text/html" }),
            "text/plain": new Blob([plainTextOf(file.content)], {
              type: "text/plain",
            }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(
          isHtml ? plainTextOf(file.content) : file.content,
        );
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable: Open the page and copy from there.
    }
  };
  return (
    <div className="asst-doc">
      <div className="asst-doc-head">
        <span className="asst-doc-icon">
          <DocIcon />
        </span>
        <span className="asst-doc-text">
          <span className="asst-doc-title">{file.title}</span>
          <span className="asst-doc-meta">
            {file.name} · {kb(file.content)}
            {file.subtitle ? ` · ${file.subtitle}` : ""}
          </span>
        </span>
        <span className="asst-doc-actions">
          {isHtml && (
            <button
              type="button"
              className="asst-doc-btn"
              onClick={open}
              title="Open in a new tab; print from there to save a PDF"
            >
              Open
            </button>
          )}
          <button
            type="button"
            className="asst-doc-btn"
            onClick={copy}
            title={
              isHtml
                ? "Copy with formatting, ready to paste into Word or Google Docs"
                : "Copy the text"
            }
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            className="asst-doc-btn primary"
            onClick={download}
            title={`Download ${file.name}`}
          >
            Download
          </button>
        </span>
      </div>
      <details className="asst-doc-preview">
        <summary>Preview</summary>
        {isHtml ? (
          <PageFrame title={file.title} html={file.content} />
        ) : (
          <pre>{file.content}</pre>
        )}
      </details>
    </div>
  );
}

/** Width at which the page is laid out before scaling to fit the pane. */
const PAGE_LAYOUT_PX = 800;
const PAGE_STAGE_PX = 520;

/**
 * The page in a sandboxed frame, laid out at a fixed width and scaled down
 * to fit, so a narrow pane shows a small page rather than a reflowed one.
 */
function PageFrame({ title, html }: { title: string; html: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const fit = () =>
      setScale(Math.min(1, el.clientWidth / PAGE_LAYOUT_PX) || 1);
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={stage}
      className="asst-doc-stage"
      style={{ height: PAGE_STAGE_PX }}
    >
      <iframe
        className="asst-doc-frame"
        title={title}
        sandbox=""
        srcDoc={html}
        style={{
          width: PAGE_LAYOUT_PX,
          height: PAGE_STAGE_PX / scale,
          transform: `scale(${scale})`,
        }}
      />
    </div>
  );
}

/** Ticks while the assistant works: "Working · 4.2 s". */
function Working({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  return (
    <li className="asst-step working" aria-live="polite">
      Working <span className="asst-step-elapsed">{seconds(now - since)}</span>
    </li>
  );
}

export function AssistantPanel({
  signedIn,
  focus,
  getContext,
  applyTable,
  applyName,
  focusParameter: focusParam,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  // A callout above the trigger (speech bubble + two bounces of the button),
  // meant as a teaching moment. Off for now: NUDGE_ENABLED gates the timer;
  // later this can be driven by state instead (first visit, table errors…).
  const [nudge, setNudge] = useState(false);
  useEffect(() => {
    if (!NUDGE_ENABLED) return;
    const t = setTimeout(() => setNudge(true), NUDGE_DELAY_MS);
    return () => clearTimeout(t);
  }, []);
  const {
    items,
    busy,
    pendingQuestion,
    send,
    attachedBytes,
    cancel,
    undoTurn,
    reset,
    focusParameter,
  } = useAssistant({
    getContext,
    applyTable,
    applyName,
    focusParameter: focusParam,
  });
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Files waiting in the composer, and the last problem adding one.
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  useEffect(() => {
    if (!attachError) return;
    const t = setTimeout(() => setAttachError(null), 6000);
    return () => clearTimeout(t);
  }, [attachError]);
  const addFiles = useCallback(
    async (list: ArrayLike<File> | null | undefined) => {
      const files = Array.from(list ?? []);
      if (!files.length) return;
      const room = MAX_FILES_PER_MESSAGE - attachmentsRef.current.length;
      if (room <= 0) {
        setAttachError(`At most ${MAX_FILES_PER_MESSAGE} files per message.`);
        return;
      }
      const errors: string[] = [];
      for (const f of files.slice(0, room)) {
        try {
          const a = await attachFile(f);
          setAttachments((old) =>
            old.length < MAX_FILES_PER_MESSAGE ? [...old, a] : old,
          );
        } catch (e) {
          errors.push(e instanceof Error ? e.message : String(e));
        }
      }
      if (files.length > room)
        errors.push(`At most ${MAX_FILES_PER_MESSAGE} files per message.`);
      if (errors.length) setAttachError(errors.join(" "));
    },
    [],
  );
  const removeAttachment = (id: string) =>
    setAttachments((old) => {
      const gone = old.find((a) => a.id === id);
      if (gone) releaseAttachment(gone);
      return old.filter((a) => a.id !== id);
    });
  const pendingBytes = totalBytes(attachments);
  const overBudget = attachedBytes + pendingBytes > MAX_CONVERSATION_BYTES;
  // The skills menu, from the slash button or a "/" typed in an empty box.
  const [skillsOpen, setSkillsOpen] = useState(false);
  const closeSkills = useCallback(() => setSkillsOpen(false), []);

  // Pane width: dragged from the left edge, or toggled wide from the header.
  const [width, setWidth] = useState<number>(loadWidth);
  const [resizing, setResizing] = useState(false);
  const isWide = width >= (WIDTH_DEFAULT + WIDTH_WIDE) / 2;
  const applyWidth = useCallback((w: number) => {
    const c = clampWidth(w);
    setWidth(c);
    saveWidth(c);
  }, []);
  useEffect(() => {
    const onResize = () => setWidth((w) => clampWidth(w));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setResizing(true);
    const move = (ev: PointerEvent) =>
      setWidth(clampWidth(window.innerWidth - ev.clientX));
    const stop = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      setResizing(false);
      applyWidth(window.innerWidth - ev.clientX);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  // Keep the newest entry in view; focus the box when the pane opens.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items, busy]);
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      setNudge(false);
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Escape closes the skills menu first, then the pane.
      if (skillsOpen) setSkillsOpen(false);
      else setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, skillsOpen]);

  const submit = (text: string) => {
    if (!signedIn || busy) return;
    if (!text.trim() && !attachmentsRef.current.length) return;
    if (overBudget) {
      setAttachError(
        `Attachments in this conversation would total ${formatBytes(
          attachedBytes + pendingBytes,
        )}; the limit is ${formatBytes(
          MAX_CONVERSATION_BYTES,
        )}. Clear the chat to attach more, or remove a file.`,
      );
      return;
    }
    const atts = attachmentsRef.current;
    setDraft("");
    setAttachments([]);
    setAttachError(null);
    void send(text, atts).finally(() => atts.forEach(releaseAttachment));
  };
  // Run from the menu: the skill's trigger plus the draft (the scientist's
  // own question) or, with an empty box, the skill's standing prompt.
  const runSkill = (id: string) => {
    const skill = skillById(id);
    if (!skill) return;
    submit(runMessage(skill, draft));
    inputRef.current?.focus();
  };

  // The strip under the header: the row or cell the scientist last clicked,
  // and its current value when it is a cell — so "this cell" has a referent.
  const focusValue = (() => {
    if (!focus || focus.column === null) return null;
    const vi = letterToValueIndex(focus.column);
    if (vi === null) return null;
    const row = getContext().table.rows.find((r) => r.name === focus.parameter);
    return row?.values[vi] ?? "";
  })();

  const groups = groupItems(items);
  const lastGroup = groups[groups.length - 1];
  const workingSince =
    [...items].reverse().find((it) => it.kind === "user")?.at ?? Date.now();
  // While working, the ticking row joins the current timeline (or starts one).
  const workingInline = busy && lastGroup?.type === "steps";

  return (
    <div
      className={`asst-root${resizing ? " resizing" : ""}`}
      style={{ "--asst-width": `${width}px` } as CSSProperties}
    >
      {nudge && !open && (
        <div className="asst-nudge" role="status">
          <button
            className="asst-nudge-body"
            onClick={() => setOpen(true)}
            title="Open the EasyEyes Assistant"
          >
            <span className="asst-nudge-kicker">New</span>
            Describe your study in plain English — the assistant builds it.
          </button>
          <button
            className="asst-nudge-close"
            onClick={() => setNudge(false)}
            aria-label="Dismiss"
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      <button
        className={`asst-fab${open ? " open" : ""}${busy ? " busy" : ""}${
          nudge && !open ? " nudging" : ""
        }`}
        onClick={() => setOpen((o) => !o)}
        title={
          open ? "Close the EasyEyes Assistant" : "Open the EasyEyes Assistant"
        }
        aria-expanded={open}
        aria-label="EasyEyes Assistant"
      >
        <EasyEyesLogo size={26} />
      </button>

      <aside
        className={`asst-drawer${open ? " open" : ""}`}
        aria-hidden={!open}
      >
        <div
          className="asst-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize the assistant pane"
          title="Drag to resize · double-click to reset"
          onPointerDown={startResize}
          onDoubleClick={() => applyWidth(WIDTH_DEFAULT)}
        />
        <div className="asst-head">
          <span
            className={`asst-status-dot${busy ? " busy" : ""}`}
            aria-hidden="true"
          />
          <span className="asst-title">
            EasyEyes Assistant
            <span className="studio-beta">beta</span>
          </span>
          <div className="asst-head-actions">
            {items.length > 0 && (
              <button
                className="asst-text-btn"
                onClick={reset}
                title="Start a new conversation"
                disabled={busy}
              >
                Clear
              </button>
            )}
            <button
              className="asst-icon"
              onClick={() => applyWidth(isWide ? WIDTH_DEFAULT : WIDTH_WIDE)}
              title={isWide ? "Narrow the pane" : "Widen the pane"}
              aria-label={isWide ? "Narrow the pane" : "Widen the pane"}
            >
              <WidthIcon wide={isWide} />
            </button>
            <button
              className="asst-icon"
              onClick={() => setOpen(false)}
              title="Close"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* What was last clicked in the grid — the assistant's "this cell" /
            "this row". Nothing is shown until something is clicked. */}
        {focus && (
          <div
            className="asst-context"
            title="What you last clicked in the grid — the assistant reads “this cell” / “this row” as this"
          >
            <span className="asst-chip">
              {focus.column !== null && (
                <span className="asst-chip-col">Column {focus.column} · </span>
              )}
              {focus.parameter}
            </span>
            {focus.column === null ? (
              <span className="asst-context-note">row</span>
            ) : focusValue === "" ? (
              <span className="asst-context-note">empty</span>
            ) : (
              <span className="asst-value">{focusValue}</span>
            )}
          </div>
        )}

        <div className="asst-log" ref={logRef}>
          {items.length === 0 && (
            <div className="asst-hero">
              <HeroMark />
              <h2>Your study, in plain English</h2>
              <p>
                Describe a study or a change to it. The assistant builds it,
                checks it with the compiler, and every reply can be undone.
              </p>
              {!signedIn && (
                <div className="asst-signin">
                  Sign in on the Compiler tab to use the assistant.
                </div>
              )}
            </div>
          )}
          {groups.map((g, gi) =>
            g.type === "steps" ? (
              <ol className="asst-steps" key={g.key}>
                {g.steps.map((s) => (
                  <Step key={s.id} step={s} />
                ))}
                {workingInline && gi === groups.length - 1 && (
                  <Working since={workingSince} />
                )}
              </ol>
            ) : (
              <Entry
                key={g.key}
                item={g.item}
                turnStart={g.turnStart}
                onUndo={undoTurn}
                onOption={submit}
                onFocus={focusParameter}
              />
            ),
          )}
          {busy && !workingInline && (
            <ol className="asst-steps">
              <Working since={workingSince} />
            </ol>
          )}
        </div>

        {items.length === 0 && signedIn && (
          <div className="asst-suggestions">
            <span className="asst-suggestions-label">Examples</span>
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                className="asst-suggestion"
                onClick={() => submit(s)}
                title="Send this example"
              >
                <span className="asst-suggestion-num">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="asst-suggestion-text">{s}</span>
              </button>
            ))}
          </div>
        )}

        <form
          className="asst-compose"
          onSubmit={(e) => {
            e.preventDefault();
            submit(draft);
          }}
        >
          {/* The input box: the text on top; under it the controls row —
              attach, the Skills pill, and Send. Files arrive from the clip,
              a drop on the box, or an image pasted into the text. */}
          <div
            className={`asst-box${signedIn ? "" : " disabled"}${
              dropping ? " dropping" : ""
            }`}
            onDragOver={(e) => {
              if (!signedIn || busy) return;
              if (!Array.from(e.dataTransfer.types).includes("Files")) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              if (!dropping) setDropping(true);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node | null))
                return;
              setDropping(false);
            }}
            onDrop={(e) => {
              if (!signedIn || busy) return;
              e.preventDefault();
              setDropping(false);
              void addFiles(e.dataTransfer.files);
            }}
          >
            {attachments.length > 0 && (
              <ul className="asst-attachments" aria-label="Attached files">
                {attachments.map((a) => (
                  <li key={a.id} className={`asst-attachment ${a.kind}`}>
                    {a.kind === "image" && a.previewUrl ? (
                      <img
                        className="asst-attachment-thumb"
                        src={a.previewUrl}
                        alt=""
                      />
                    ) : (
                      <span className="asst-attachment-kind">
                        {a.kind === "table" ? "CSV" : "TXT"}
                      </span>
                    )}
                    <span className="asst-attachment-name" title={a.name}>
                      {a.name}
                    </span>
                    <span className="asst-attachment-size">
                      {formatBytes(a.bytes)}
                    </span>
                    <button
                      type="button"
                      className="asst-attachment-remove"
                      onClick={() => removeAttachment(a.id)}
                      aria-label={`Remove ${a.name}`}
                      title="Remove"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {attachError && (
              <div className="asst-attach-error" role="alert">
                {attachError}
              </div>
            )}
            <textarea
              ref={inputRef}
              className="asst-input"
              rows={1}
              value={draft}
              placeholder={
                !signedIn
                  ? "Sign in on the Compiler tab to use the assistant"
                  : pendingQuestion
                  ? "Your answer…"
                  : "Describe a study or a change…"
              }
              disabled={!signedIn}
              onChange={(e) => {
                const v = e.target.value;
                setDraft(v);
                // A lone "/" opens the skills menu, like the trigger would.
                if (v === "/" && !busy) setSkillsOpen(true);
                else if (skillsOpen && !v.startsWith("/")) setSkillsOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (skillsOpen && draft.trim() === "/") return;
                  submit(draft);
                }
              }}
              onPaste={(e) => {
                // A pasted image (a screenshot) attaches; text pastes as usual.
                const files = Array.from(e.clipboardData.files).filter((f) =>
                  f.type.startsWith("image/"),
                );
                if (!files.length || busy) return;
                e.preventDefault();
                void addFiles(files);
              }}
            />
            <div className="asst-box-row">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                multiple
                hidden
                onChange={(e) => {
                  void addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                className="asst-attach"
                disabled={!signedIn || busy}
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach files"
                title={`Attach files: ${ACCEPTED_DESCRIPTION}. Or drop them here, or paste an image.`}
              >
                <AttachIcon />
              </button>
              <div className="asst-skills">
                <button
                  type="button"
                  className={`asst-skills-pill${skillsOpen ? " open" : ""}`}
                  onClick={() => setSkillsOpen((o) => !o)}
                  disabled={!signedIn || busy}
                  aria-haspopup="menu"
                  aria-expanded={skillsOpen}
                  title="Skills"
                >
                  <SkillsIcon />
                  Skills
                  <Chevron dir="down" />
                </button>
                {skillsOpen && (
                  <SkillsMenu
                    flyout={width >= 580}
                    onRun={runSkill}
                    onClose={closeSkills}
                  />
                )}
              </div>
              <span className="asst-box-spacer" />
              {busy ? (
                <button
                  type="button"
                  className="asst-send asst-stop"
                  onClick={cancel}
                  title="Stop"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  className="asst-send"
                  disabled={!signedIn || (!draft.trim() && !attachments.length)}
                  title="Send"
                >
                  Send
                </button>
              )}
            </div>
          </div>
        </form>
      </aside>
    </div>
  );
}
