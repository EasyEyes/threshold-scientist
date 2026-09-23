import * as XLSX from "xlsx";

export type PhraseTable = Map<string, Map<string, string>>;

export const parsePhraseFile = async (
  file: File,
  kind: "language" | "name" = "language",
): Promise<{
  phraseTable: PhraseTable;
  sourceLanguageCode: string;
  availableLanguageCodes: string[];
}> => {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet, {
    header: 1,
  }) as string[][];
  return buildPhraseTable(rows, kind);
};

function buildPhraseTable(
  rows: string[][],
  kind: "language" | "name",
): {
  phraseTable: PhraseTable;
  sourceLanguageCode: string;
  availableLanguageCodes: string[];
} {
  const languageCodeRow =
    kind === "name"
      ? rows[0]
      : rows.find((row) => {
          if (row[0] == null) return false;
          return ["~languagecode", "ⓛlanguagecode"].includes(
            String(row[0]).toLowerCase(),
          );
        });

  if (!languageCodeRow) {
    throw new Error(
      kind === "name"
        ? "Phrase file is missing its header row."
        : 'Phrase file is missing the required "~LanguageCode" row.',
    );
  }

  const langCodes = languageCodeRow
    .slice(1)
    .map((value) => (value == null ? "" : String(value).trim()));

  if (langCodes.length === 0 || langCodes.some((code) => !code)) {
    throw new Error(
      "Phrase file has no language columns beyond the first column.",
    );
  }

  if (new Set(langCodes).size !== langCodes.length) {
    throw new Error("Phrase file has duplicate column names.");
  }

  const phraseTable: PhraseTable = new Map();

  for (const row of kind === "name" ? rows.slice(1) : rows) {
    const symbolicName = row[0];
    if (symbolicName == null || symbolicName === "") continue;
    const normalizedKey = String(symbolicName).toLowerCase();
    if (
      !normalizedKey.startsWith(kind === "name" ? "ⓝ" : "ⓛ") &&
      !(kind === "language" && normalizedKey.startsWith("~"))
    ) {
      throw new Error(
        `Phrase name ${symbolicName} must start with ${
          kind === "name" ? "Ⓝ" : "Ⓛ"
        }.`,
      );
    }

    if (phraseTable.has(normalizedKey)) {
      throw new Error(`Duplicate phrase name ${symbolicName}.`);
    }
    if (/\s/u.test(String(symbolicName))) {
      throw new Error(`Phrase name ${symbolicName} contains spaces.`);
    }

    const langMap = new Map<string, string>();
    for (let i = 0; i < langCodes.length; i++) {
      const cell = row[i + 1];
      const value = cell != null ? String(cell) : "";
      if (
        (kind === "name" && value.includes("Ⓝ")) ||
        (kind === "language" && /[ⓃⓁ]/u.test(value))
      ) {
        throw new Error(
          `Phrase ${symbolicName} contains a disallowed symbolic name.`,
        );
      }
      langMap.set(langCodes[i], value);
    }
    phraseTable.set(normalizedKey, langMap);
  }

  return {
    phraseTable,
    sourceLanguageCode: langCodes[0],
    availableLanguageCodes: langCodes,
  };
}
