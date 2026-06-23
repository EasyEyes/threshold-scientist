import * as XLSX from "xlsx";

export type PhraseTable = Map<string, Map<string, string>>;

export const parsePhraseFile = (
  file: File,
): Promise<{
  phraseTable: PhraseTable;
  sourceLanguageCode: string;
  availableLanguageCodes: string[];
}> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target!.result as ArrayBuffer;
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, {
          header: 1,
        }) as string[][];
        resolve(buildPhraseTable(rows));
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

function buildPhraseTable(rows: string[][]): {
  phraseTable: PhraseTable;
  sourceLanguageCode: string;
  availableLanguageCodes: string[];
} {
  const languageCodeRow = rows.find(
    (row) => row[0] != null && String(row[0]).toLowerCase() === "~languagecode",
  );

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
    const normalizedKey = String(symbolicName).toLowerCase();

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
