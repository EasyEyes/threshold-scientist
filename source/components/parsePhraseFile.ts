import * as XLSX from "xlsx";

export type PhraseTable = Map<string, Map<string, string>>;

export const parsePhraseFile = async (
  file: File,
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
  return buildPhraseTable(rows);
};

function buildPhraseTable(rows: string[][]): {
  phraseTable: PhraseTable;
  sourceLanguageCode: string;
  availableLanguageCodes: string[];
} {
  const languageCodeRow = rows.find((row) => {
    if (row[0] == null) return false;
    const normalized = String(row[0]).replace(/^~/, "").toLowerCase();
    return normalized === "languagecode";
  });

  if (!languageCodeRow) {
    throw new Error('Phrase file is missing the required "~LanguageCode" row.');
  }

  const langCodes = languageCodeRow
    .slice(1)
    .map(String)
    .filter((v) => v !== "" && v !== "undefined");

  if (langCodes.length === 0) {
    throw new Error(
      "Phrase file has no language columns beyond the first column.",
    );
  }

  const phraseTable: PhraseTable = new Map();

  for (const row of rows) {
    const symbolicName = row[0];
    if (symbolicName == null || symbolicName === "") continue;
    const normalizedKey = String(symbolicName).replace(/^~/, "").toLowerCase();

    const langMap = new Map<string, string>();
    for (let i = 0; i < langCodes.length; i++) {
      const cell = row[i + 1];
      langMap.set(langCodes[i], cell != null ? String(cell) : "");
    }
    phraseTable.set(normalizedKey, langMap);
  }

  return {
    phraseTable,
    sourceLanguageCode: langCodes[0],
    availableLanguageCodes: langCodes,
  };
}
