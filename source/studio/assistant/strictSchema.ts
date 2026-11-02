/**
 * Strict tool schemas.
 *
 * With `strict: true` on a tool, the model API guarantees that every
 * `tool_use.input` validates against the tool's `input_schema`, so a
 * malformed call never reaches runTool and never costs a round. Strict mode
 * accepts a subset of JSON Schema: every object needs
 * `additionalProperties: false` and a `required` list; `anyOf`, `enum` and
 * `const` are fine; numeric and string constraints (minimum, maxLength…)
 * are not, and `additionalProperties` may only ever be `false` — so a
 * free-form `{parameter: value}` map cannot be expressed. Those maps are
 * sent as a list of `{parameter, value}` pairs instead (PAIRS_SCHEMA) and
 * folded back into an object before the builder or a knob sees them
 * (`pairsToMap`).
 *
 * `strictTool` applies all of that to a tool definition written in the
 * natural, permissive style the rest of the Studio uses, so a schema can
 * keep saying `type: ["number", "string"]` or `additionalProperties:
 * {type: "string"}` in source and still go out strict.
 */

export type JsonSchema = Record<string, unknown>;

/** A `{parameter: value}` map, as strict mode can carry it. */
export const PAIRS_SCHEMA: JsonSchema = {
  type: "array",
  description:
    "Parameter/value pairs, e.g. [{parameter: 'viewingDistanceDesiredCm', value: '40'}].",
  items: {
    type: "object",
    properties: {
      parameter: { type: "string", description: "Glossary parameter name." },
      value: { type: "string", description: "The cell's text." },
    },
    required: ["parameter", "value"],
    additionalProperties: false,
  },
};

/** Keys strict mode rejects; they are dropped (the executor still checks). */
const UNSUPPORTED_KEYS = new Set([
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "pattern",
  "minItems",
  "maxItems",
  "uniqueItems",
  "minProperties",
  "maxProperties",
  "default",
]);

const isObject = (v: unknown): v is JsonSchema =>
  !!v && typeof v === "object" && !Array.isArray(v);

/** A free-form map (`additionalProperties` that is a schema, not `false`). */
const isMapSchema = (s: JsonSchema): boolean =>
  s.type === "object" &&
  !("properties" in s) &&
  "additionalProperties" in s &&
  s.additionalProperties !== false;

/**
 * The strict-mode version of a schema: objects closed and with `required`,
 * `type` arrays as `anyOf`, maps as pairs, unsupported constraints removed.
 * Pure; the input is not touched. Idempotent.
 */
export function strictSchema(schema: unknown): JsonSchema {
  if (!isObject(schema)) return {};
  if (isMapSchema(schema)) {
    const { description } = schema;
    return typeof description === "string"
      ? {
          ...PAIRS_SCHEMA,
          description: `${description} ${PAIRS_SCHEMA.description}`,
        }
      : { ...PAIRS_SCHEMA };
  }

  const out: JsonSchema = {};
  for (const [key, value] of Object.entries(schema)) {
    if (UNSUPPORTED_KEYS.has(key)) continue;
    out[key] = value;
  }

  // `type: ["number", "string"]` → anyOf of single types.
  if (Array.isArray(out.type)) {
    const types = out.type as string[];
    delete out.type;
    out.anyOf = types.map((t) => ({ type: t }));
  }

  if (isObject(out.properties)) {
    const props: JsonSchema = {};
    for (const [name, sub] of Object.entries(out.properties))
      props[name] = strictSchema(sub);
    out.properties = props;
  }
  if (out.type === "object" || isObject(out.properties)) {
    out.additionalProperties = false;
    if (!Array.isArray(out.required)) out.required = [];
  }
  if (isObject(out.items)) out.items = strictSchema(out.items);
  for (const combinator of ["anyOf", "allOf", "oneOf"] as const) {
    const list = out[combinator];
    if (Array.isArray(list)) out[combinator] = list.map(strictSchema);
  }
  return out;
}

export interface ToolDefinition {
  name: string;
  description?: string;
  input_schema: unknown;
  strict?: boolean;
}

/** The tool with `strict: true` and a strict-mode `input_schema`. */
export const strictTool = <T extends ToolDefinition>(
  tool: T,
): T & { strict: true; input_schema: JsonSchema } => ({
  ...tool,
  strict: true,
  input_schema: strictSchema(tool.input_schema),
});

/**
 * A `{parameter: value}` object from what the model sent: the strict
 * pairs list, or the map itself (older transcripts, tests). Anything
 * else — and empty names — is dropped. Undefined when there is nothing.
 */
export function pairsToMap(v: unknown): Record<string, string> | undefined {
  if (Array.isArray(v)) {
    const out: Record<string, string> = {};
    for (const item of v) {
      if (!isObject(item)) continue;
      const key = String(item.parameter ?? "").trim();
      if (key) out[key] = String(item.value ?? "");
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (isObject(v)) {
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v)) {
      const key = k.trim();
      if (key) out[key] = String(val ?? "");
    }
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
}
