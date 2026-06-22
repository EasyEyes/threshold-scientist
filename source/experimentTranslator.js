function extractTranslatableTexts(spreadsheet, translatableKeys) {
  console.log(
    "[extractTranslatableTexts] translatableKeys type:",
    typeof translatableKeys,
    "value:",
    translatableKeys,
  );
  const keySet = new Set(translatableKeys);
  const seen = new Set();
  for (const row of spreadsheet) {
    if (!keySet.has(row[0])) continue;
    for (let i = 1; i < row.length; i++) {
      if (row[i] != null && row[i] !== "") seen.add(row[i]);
    }
  }
  return Array.from(seen);
}

function applyTranslations(spreadsheet, translationMap, translatableKeys) {
  const keySet = new Set(translatableKeys);
  return spreadsheet.map((row) => {
    if (!keySet.has(row[0])) return row;
    return row.map((cell, i) => {
      if (i === 0) return cell;
      return translationMap[cell] !== undefined ? translationMap[cell] : cell;
    });
  });
}

module.exports = { extractTranslatableTexts, applyTranslations };
