export interface GlossaryEntry {
  name: string;
  availability: string;
  type: string;
  default: string;
  explanation: string;
  categories?: string[];
}

export interface GlossaryFullEntry {
  name: string;
  availability: string;
  example: string;
  explanation: string;
  type: string;
  default: string;
  categories: string;
}

function getCategoriesFromString(str: string): string[] {
  return str
    .split(",")
    .map((s) => s.trim())
    .filter((x) => x);
}

function isCategorical(type: string): boolean {
  return type === "categorical" || type === "multicategorical";
}

function rowsToObjects(rows: string[][]): Record<string, string>[] {
  const [headers, ...dataRows] = rows;
  return dataRows.map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, i) => {
      obj[header] = row[i] ?? "";
    });
    return obj;
  });
}

export function transformRows(rows: string[][]): {
  glossary: Record<string, GlossaryEntry>;
  glossaryFull: GlossaryFullEntry[];
  superMatchingParams: string[];
} {
  const parameters = rowsToObjects(rows);

  const glossary: Record<string, GlossaryEntry> = {};
  for (const parameter of parameters) {
    const parameterName = parameter["INPUT PARAMETER"];
    if (parameterName.includes("__")) continue;
    const entry: GlossaryEntry = {
      name: parameterName,
      availability: parameter["NOW"] || "now",
      type: parameter["TYPE"],
      default: parameter["DEFAULT"],
      explanation: parameter["EXPLANATION"],
    };
    if (isCategorical(entry.type)) {
      entry.categories = getCategoriesFromString(parameter["CATEGORIES"]);
    }
    glossary[parameterName] = entry;
  }

  const glossaryFull: GlossaryFullEntry[] = [];
  for (const parameter of parameters) {
    const parameterName = parameter["INPUT PARAMETER"];
    if (parameterName.includes("__")) continue;
    const type = parameter["TYPE"];
    glossaryFull.push({
      name: parameterName,
      availability: parameter["NOW"] || "now",
      example: parameter["EXAMPLE"],
      explanation: parameter["EXPLANATION"],
      type,
      default: parameter["DEFAULT"],
      categories: isCategorical(type) ? parameter["CATEGORIES"] : "",
    });
  }

  const superMatchingParams = Object.keys(glossary).filter((key) =>
    key.includes("@"),
  );

  return { glossary, glossaryFull, superMatchingParams };
}
