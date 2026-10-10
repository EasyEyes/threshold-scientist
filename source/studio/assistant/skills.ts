/**
 * Skills: optional capabilities the scientist switches on per conversation.
 *
 * The assistant's standing behavior (prompt.ts, tools.ts) never changes. A
 * skill adds to a request only while it is on: one system block with its
 * instructions and some tools of its own, which it also executes. Off, it
 * contributes nothing and the request is byte-identical to the usual one.
 *
 * Skills are run from the composer's Skills menu — Run submits the skill's
 * own prompt (or the scientist's draft) with the trigger in front, so no
 * typing is needed — or by starting a message with the trigger
 * ("/methods …"). Once a conversation has used a skill's tools, the skill
 * stays on until Clear, so the transcript's tool_use blocks always have a
 * definition behind them and follow-up questions keep the skill's context.
 *
 * Adding a skill = one module exporting a `Skill`, plus a line in SKILLS.
 * A skill without `prompt` (or with `menu: false`) is reachable only by its
 * trigger.
 */
import type { ApiMessage } from "./api";
import type { SystemBlock } from "./prompt";
import type { AssistantContext, ToolOutcome } from "./tools";
import { codeLookupSkill } from "./codeSkill";
import { feasibilitySkill } from "./feasibilitySkill";
import { methodsSkill } from "./methodsSkill";

export interface Skill {
  id: string;
  /** Menu label, e.g. "Code lookup". */
  title: string;
  /** One line under the label: what turning it on lets the assistant do. */
  summary: string;
  /** Message prefix that turns it on, e.g. "/code". */
  trigger: string;
  /** What Run sends when the box is empty. Without it the menu has no Run. */
  prompt?: string;
  /** false hides the skill from the menu; the trigger still works. */
  menu?: boolean;
  /** Anthropic tool definitions, added to the request while on. */
  tools: readonly unknown[];
  toolNames: ReadonlySet<string>;
  /** The skill's system block, appended after the cached reference. */
  systemBlock: () => Promise<SystemBlock>;
  /** Executes one of the skill's tools, with the table as the tools have left it. */
  run: (
    name: string,
    input: Record<string, unknown>,
    ctx: AssistantContext,
  ) => Promise<ToolOutcome>;
}

export const SKILLS: readonly Skill[] = [
  feasibilitySkill,
  methodsSkill,
  codeLookupSkill,
];

/** The skills the composer's menu lists. */
export const MENU_SKILLS: readonly Skill[] = SKILLS.filter(
  (s) => s.menu !== false && s.prompt,
);

export const skillById = (id: string): Skill | undefined =>
  SKILLS.find((s) => s.id === id);

/** The message Run submits: the trigger, then the draft or the skill's prompt. */
export const runMessage = (skill: Skill, draft: string): string => {
  const own = draft.trim() === "/" ? "" : draft.trim();
  return `${skill.trigger} ${own || skill.prompt || ""}`.trim();
};

/** The skill that owns a tool name, if any. */
export const skillForTool = (name: string): Skill | undefined =>
  SKILLS.find((s) => s.toolNames.has(name));

/**
 * A leading trigger ("/code how…"): the text without it and the skill it
 * names. "/code" alone counts, with empty text. Anything else is untouched.
 */
export function parseSkillTrigger(text: string): {
  text: string;
  skill: Skill | null;
} {
  for (const skill of SKILLS) {
    const re = new RegExp(
      `^\\s*${skill.trigger.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      )}(?=\\s|$)\\s*`,
      "i",
    );
    const m = text.match(re);
    if (m) return { text: text.slice(m[0].length), skill };
  }
  return { text, skill: null };
}

/** Ids of the skills whose tools the transcript has already called. */
export function skillsUsedIn(messages: ApiMessage[]): Set<string> {
  const used = new Set<string>();
  for (const m of messages) {
    if (m.role !== "assistant") continue;
    for (const b of m.content) {
      if (b.type !== "tool_use") continue;
      const skill = skillForTool((b as { name?: string }).name ?? "");
      if (skill) used.add(skill.id);
    }
  }
  return used;
}
