export function extractEnglishMap(rows) {
  if (rows.length < 2) return {};
  const header = rows[0];
  const keyIdx = header.indexOf("key");
  const enIdx = header.indexOf("en");
  if (keyIdx === -1 || enIdx === -1) return {};
  const result = {};
  for (let i = 1; i < rows.length; i++) {
    const key = rows[i][keyIdx];
    if (key) result[key] = rows[i][enIdx] || "";
  }
  return result;
}

export function buildDiffPayload(english, nonCyanValues) {
  return { action: "diff", english, nonCyanValues };
}

export function extractNonTranslatableValues(rows, backgrounds) {
  if (rows.length < 2) return {};
  const header = rows[0];
  const keyIdx = header.indexOf("key");
  const enIdx = header.indexOf("en");
  if (keyIdx === -1 || enIdx === -1) return {};
  const result = {};
  for (let i = 1; i < rows.length; i++) {
    const key = rows[i][keyIdx];
    if (!key) continue;
    const bgRow = backgrounds[i];
    const rowVals = {};
    for (let h = 0; h < header.length; h++) {
      if (!header[h] || h === keyIdx || h === enIdx) continue;
      if (!isTranslatableBackground(bgRow[h])) {
        rowVals[header[h]] = rows[i][h] || "";
      }
    }
    if (Object.keys(rowVals).length > 0) result[key] = rowVals;
  }
  return result;
}

export function isTranslatableBackground(hex) {
  if (!hex) return false;
  return hex.toLowerCase().trim() === "#00ffff";
}

export function buildTranslatePayload(
  rows,
  backgrounds,
  changedKeys,
  currentVersion,
  isFullResync,
) {
  const header = rows[0];
  const keyIdx = header.indexOf("key");
  const enIdx = header.indexOf("en");
  const targetLangs = header.filter((h, i) => h && i !== keyIdx && i !== enIdx);
  const targetIdxs = targetLangs.map((lang) => header.indexOf(lang));

  const keyToRowIdx = {};
  for (let i = 1; i < rows.length; i++) {
    const k = rows[i][keyIdx];
    if (k) keyToRowIdx[k] = i;
  }

  const changedPhrases = {};
  const colorMask = {};
  const sentValues = {};

  for (const key of changedKeys) {
    const ri = keyToRowIdx[key];
    if (ri === undefined) continue;
    const row = rows[ri];
    const bgRow = backgrounds[ri];
    changedPhrases[key] = row[enIdx] || "";
    colorMask[key] = {};
    sentValues[key] = {};
    for (let j = 0; j < targetLangs.length; j++) {
      const lang = targetLangs[j];
      const ci = targetIdxs[j];
      colorMask[key][lang] = isTranslatableBackground(bgRow[ci]);
      sentValues[key][lang] = row[ci] || "";
    }
  }

  return {
    action: isFullResync ? "fullResync" : "translate",
    changedPhrases,
    colorMask,
    sentValues,
    currentVersion,
  };
}

export function findMissingTranslatableKeys(colorMask, changedKeys) {
  return changedKeys.filter((key) => {
    const mask = colorMask[key];
    if (!mask) return true;
    return Object.values(mask).every((v) => !v);
  });
}

export function planWriteBack(translatedRows, rows) {
  const header = rows[0];
  const keyIdx = header.indexOf("key");
  const enIdx = header.indexOf("en");

  const keyToRowIdx = {};
  for (let i = 1; i < rows.length; i++) {
    const k = rows[i][keyIdx];
    if (k) keyToRowIdx[k] = i;
  }

  const writes = [];
  for (const [key, langValues] of Object.entries(translatedRows)) {
    const ri = keyToRowIdx[key];
    if (ri === undefined) continue;
    for (const [lang, value] of Object.entries(langValues)) {
      const ci = header.indexOf(lang);
      if (ci === -1 || ci === keyIdx || ci === enIdx) continue;
      writes.push({ rowIndex: ri, colIndex: ci, value });
    }
  }
  return writes;
}
