/**
 * Two-phase push of the Phrases sheet to the Netlify phrases function.
 *
 * SECRET ROTATION:
 *   1. Generate a new secret (e.g. openssl rand -hex 32).
 *   2. Update PHRASES_SECRET in Script Properties (File > Project settings >
 *      Script properties) on this script.
 *   3. Update PHRASES_SECRET in Netlify environment variables for the
 *      threshold-scientist site.
 *   4. Verify a test push succeeds before discarding the old secret.
 *
 * ACCESS CONTROL:
 *   Share this Apps Script project with Editor-or-higher only
 *   (Share button in the Apps Script IDE). Viewers must not be able to run it.
 */

var PHRASES_FUNCTION_URL =
  "https://easyeyes.app/.netlify/functions/phrases";

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("EasyEyes")
    .addItem("Update EasyEyes to use current phrases", "updatePhrases")
    .addItem("Re-translate Selected Cells", "retranslateSelectedCells")
    .addToUi();
}

function notify(message, type) {
  type = type || "warning";
  var isSuccess = type === "success";

  // Modern color palette
  var colors = isSuccess ? {
    bg: "#f0fdf4",
    accent: "#16a34a",
    text: "#166534",
    border: "#dcfce7",
    hoverDark: "#15803d"
  } : {
    bg: "#fffbeb",
    accent: "#d97706",
    text: "#92400e",
    border: "#fef3c7",
    hoverDark: "#b45309"
  };

  var title = isSuccess ? "Success" : "Warning";
  var safeMsg = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  var html = `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
      }
      .container {
        width: 100%;
        padding: 16px;
      }
      .card {
        background: ` + colors.bg + `;
        border: 1.5px solid ` + colors.border + `;
        border-radius: 12px;
        padding: 8px 24px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04);
        text-align: center;
        animation: slideUp 0.3s ease-out;
      }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .icon-wrapper {
        width: 56px;
        height: 56px;
        margin: 0 auto 16px;
        color: ` + colors.accent + `;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        font-weight: bold;
      }
      .title {
        font-size: 18px;
        font-weight: 600;
        color: ` + colors.accent + `;
        margin-bottom: 10px;
        letter-spacing: -0.3px;
      }
      .message {
        font-size: 14px;
        color: ` + colors.text + `;
        line-height: 1.6;
        margin-bottom: 20px;
        word-break: break-word;
        white-space: pre-wrap;
      }
      .button {
        background: ` + colors.accent + `;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 10px 28px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
        letter-spacing: 0.3px;
      }
      .button:hover {
        background: ` + colors.hoverDark + `;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transform: translateY(-2px);
      }
      .button:active {
        transform: translateY(0);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
    </style>
    <div class="container">
      <div class="card">
        <div class="icon-wrapper">` + (isSuccess ? "✅" : "⚠️") + `</div>
        <div class="message">` + safeMsg + `</div>
        <button class="button" onclick="google.script.host.close()">OK</button>
      </div>
    </div>
  `;

  try {
    SpreadsheetApp.getUi().showModelessDialog(
      HtmlService.createHtmlOutput(html),
      title
    );
  } catch (e) {
    Logger.log("[phrases] " + message);
  }
}

function updatePhrases() {
  pushPhrases(false);
}

function fullResyncPhrases() {
  pushPhrases(true);
}

function pushPhrases(isFullResync) {
  var secret = PropertiesService.getScriptProperties().getProperty(
    "PHRASES_SECRET"
  );
  if (!secret) {
    notify(
      "PHRASES_SECRET is not set in Script Properties. " +
        "Add it under File > Project settings > Script properties."
    );
    return;
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Translations");
  if (!sheet) {
    notify('Sheet "Translations" not found.');
    return;
  }

  var dataRange = sheet.getDataRange();
  var rows = dataRange.getDisplayValues();
  var backgrounds = dataRange.getBackgrounds();

  // Phase 1: diff
  var english = extractEnglishMap(rows);
  var nonCyanValues = extractNonTranslatableValues(rows, backgrounds);
  var diffPayload = buildDiffPayload(english, nonCyanValues);
  var diffOptions = buildFetchOptions(secret, diffPayload);

  console.log("[phrases] Phase 1: POSTing diff to: " + PHRASES_FUNCTION_URL);
  var diffResponse = UrlFetchApp.fetch(PHRASES_FUNCTION_URL, diffOptions);
  var diffCode = diffResponse.getResponseCode();
  var diffText = diffResponse.getContentText();
  console.log("[phrases] Phase 1 response code: " + diffCode);

  if (diffCode !== 200) {
    notify("Phrases diff failed (" + diffCode + "): " + diffText);
    return;
  }

  var diffResult = JSON.parse(diffText);
  var changedKeys = diffResult.changed;
  var currentVersion = diffResult.currentVersion;

  if (!changedKeys || changedKeys.length === 0) {
    notify("Phrases are up to date. No changes detected.", "success");
    return;
  }

  // Phase 2: translate / fullResync (batched)
  var translatePayload = buildTranslatePayload(
    rows,
    backgrounds,
    changedKeys,
    currentVersion,
    isFullResync
  );

  var action = translatePayload.action;
  var changedPhrases = translatePayload.changedPhrases;
  var colorMask = translatePayload.colorMask;
  var sentValues = translatePayload.sentValues;

  var BATCH_SIZE = 50;
  var allKeys = Object.keys(changedPhrases);
  var totalBatches = Math.ceil(allKeys.length / BATCH_SIZE);
  var totalCellCount = 0;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var newVersion = currentVersion;

  for (var b = 0; b < totalBatches; b++) {
    var batchKeys = allKeys.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);

    ss.toast(
      "Translating batch " + (b + 1) + " of " + totalBatches +
        " (" + (b * BATCH_SIZE) + " of " + allKeys.length + " phrases done)…",
      "Updating phrases",
    -1
    );

    var batchChangedPhrases = {};
    var batchColorMask = {};
    var batchSentValues = {};
    for (var ki = 0; ki < batchKeys.length; ki++) {
      var bk = batchKeys[ki];
      batchChangedPhrases[bk] = changedPhrases[bk];
      batchColorMask[bk] = colorMask[bk];
      batchSentValues[bk] = sentValues[bk];
    }

    var batchPayload = {
      action: action,
      changedPhrases: batchChangedPhrases,
      colorMask: batchColorMask,
      sentValues: batchSentValues,
      currentVersion: newVersion,
    };

    console.log("[phrases] Phase 2 batch " + (b + 1) + "/" + totalBatches + ": POSTing to: " + PHRASES_FUNCTION_URL);
    var translateResponse = UrlFetchApp.fetch(PHRASES_FUNCTION_URL, buildFetchOptions(secret, batchPayload));
    var translateCode = translateResponse.getResponseCode();
    var translateText = translateResponse.getContentText();
    console.log("[phrases] Phase 2 batch " + (b + 1) + " response code: " + translateCode);

    if (translateCode === 409) {
      var retryVersion = UrlFetchApp.fetch(PHRASES_FUNCTION_URL + "?versionOnly", {
        method: "get",
        muteHttpExceptions: true,
      });
      if (retryVersion.getResponseCode() !== 200) {
        notify("Batch " + (b + 1) + " of " + totalBatches + " had a version conflict and the version re-fetch failed.\n\n" +
               "Completed " + totalCellCount + " cell(s). Please try again.");
        return;
      }
      newVersion = JSON.parse(retryVersion.getContentText()).version;
      batchPayload.currentVersion = newVersion;
      translateResponse = UrlFetchApp.fetch(PHRASES_FUNCTION_URL, buildFetchOptions(secret, batchPayload));
      translateCode = translateResponse.getResponseCode();
      translateText = translateResponse.getContentText();
      console.log("[phrases] Phase 2 batch " + (b + 1) + " retry response code: " + translateCode);
    }

    if (translateCode === 400) {
      var errMsg = "";
      try {
        errMsg = JSON.parse(translateText).error || translateText;
      } catch (e) {
        errMsg = translateText;
      }
      notify("Phrases push rejected: " + errMsg +
             "\n\nCompleted " + totalCellCount + " cell(s) before failure.");
      return;
    }

    if (translateCode !== 200) {
      notify("Batch " + (b + 1) + " of " + totalBatches + " failed (" + translateCode + "): " + translateText +
             "\n\nCompleted " + totalCellCount + " cell(s) before failure.");
      return;
    }

    var translateResult = JSON.parse(translateText);
    newVersion = translateResult.newVersion;

    // Write-back: update target-language cells only
    var writes = planWriteBack(translateResult.translatedRows || {}, rows);
    for (var j = 0; j < writes.length; j++) {
      var w = writes[j];
      try {
        // Sheet rows and columns are 1-indexed; our indices are 0-indexed
        sheet.getRange(w.rowIndex + 1, w.colIndex + 1).setValue(w.value);
      } catch (e) {
        Logger.log("[phrases] Write-back failed for rowIndex=" + w.rowIndex + " colIndex=" + w.colIndex + ": " + e);
      }
    }
    totalCellCount += writes.length;
  }

  // Warning: keys with no translatable target cells
  var missingKeys = findMissingTranslatableKeys(colorMask, changedKeys);
  if (missingKeys.length > 0) {
    notify(
      "Warning: the following phrase keys have no translatable (cyan) " +
        "target-language cells and were not translated:\n" +
        missingKeys.join(", ")
    );
  } else {
    var label = isFullResync ? "Full Resync" : "Update";
    notify("Phrases " + label + " complete. New version: " + newVersion, "success");
  }
}

function retranslateSelectedCells() {
  var secret = PropertiesService.getScriptProperties().getProperty(
    "PHRASES_SECRET"
  );
  if (!secret) {
    notify(
      "PHRASES_SECRET is not set in Script Properties. " +
        "Add it under File > Project settings > Script properties."
    );
    return;
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Translations");
  if (!sheet) {
    notify('Sheet "Translations" not found.');
    return;
  }

  var dataRange = sheet.getDataRange();
  var rows = dataRange.getDisplayValues();
  var backgrounds = dataRange.getBackgrounds();

  if (rows.length < 2) {
    notify("No data found in the Translations sheet.");
    return;
  }

  var header = rows[0];
  var keyIdx = header.indexOf("language");
  var enIdx = header.indexOf("en");
  if (keyIdx === -1 || enIdx === -1) {
    notify('Required columns "language" and "en" not found in header row.');
    return;
  }

  var rangeList = sheet.getActiveRangeList();
  if (!rangeList) {
    notify("No cells selected.");
    return;
  }
  var ranges = rangeList.getRanges();

  var nonCyanCells = [];
  var cyanCells = [];

  for (var r = 0; r < ranges.length; r++) {
    var range = ranges[r];
    var startRow = range.getRow();
    var startCol = range.getColumn();
    var numRows = range.getNumRows();
    var numCols = range.getNumColumns();

    for (var dr = 0; dr < numRows; dr++) {
      var rowIdx = startRow + dr - 1;
      if (rowIdx === 0) continue; // header
      if (rowIdx >= rows.length) continue;
      var key = (rows[rowIdx][keyIdx] || "").trim();

      for (var dc = 0; dc < numCols; dc++) {
        var colIdx = startCol + dc - 1;
        if (colIdx === keyIdx || colIdx === enIdx) continue; // non-target columns
        if (colIdx >= header.length) continue;
        var lang = header[colIdx];
        if (!lang) continue;
        if (!key) continue;

        var bg = backgrounds[rowIdx][colIdx];
        if (isTranslatableBackground(bg)) {
          cyanCells.push({
            rowIdx: rowIdx,
            colIdx: colIdx,
            key: key,
            lang: lang,
            engText: rows[rowIdx][enIdx] || "",
            currentValue: rows[rowIdx][colIdx] || "",
          });
        } else {
          nonCyanCells.push({ sheetRow: startRow + dr, lang: lang });
        }
      }
    }
  }

  var nonCyanWarning =
    nonCyanCells.length > 0
      ? nonCyanCells.length +
        " selected cell(s) were not cyan and skipped. Change their background to cyan to include them."
      : "";

  if (cyanCells.length === 0) {
    notify(
      "No translatable cells found in selection." +
        (nonCyanWarning ? "\n\n" + nonCyanWarning : "")
    );
    return;
  }

  var versionResponse = UrlFetchApp.fetch(PHRASES_FUNCTION_URL + "?versionOnly", {
    method: "get",
    muteHttpExceptions: true,
  });
  if (versionResponse.getResponseCode() !== 200) {
    notify("Failed to fetch current phrase version. Please try again.");
    return;
  }
  var currentVersion = JSON.parse(versionResponse.getContentText()).version;

  var changedPhrases = {};
  var colorMask = {};
  var sentValues = {};

  for (var i = 0; i < cyanCells.length; i++) {
    var cell = cyanCells[i];
    if (!changedPhrases[cell.key]) {
      changedPhrases[cell.key] = cell.engText;
      colorMask[cell.key] = {};
      sentValues[cell.key] = {};
    }
    colorMask[cell.key][cell.lang] = "#00ffff";
    sentValues[cell.key][cell.lang] = cell.currentValue;
  }

  var BATCH_SIZE = 50;
  var allKeys = Object.keys(changedPhrases);
  var totalBatches = Math.ceil(allKeys.length / BATCH_SIZE);
  var totalCellCount = 0;
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  for (var b = 0; b < totalBatches; b++) {
    var batchKeys = allKeys.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);

    ss.toast(
      "Translating batch " + (b + 1) + " of " + totalBatches +
        " (" + (b * BATCH_SIZE) + " of " + allKeys.length + " phrases done)…",
      "Re-translating",
      -1
    );

    var batchChangedPhrases = {};
    var batchColorMask = {};
    var batchSentValues = {};
    for (var ki = 0; ki < batchKeys.length; ki++) {
      var bk = batchKeys[ki];
      batchChangedPhrases[bk] = changedPhrases[bk];
      batchColorMask[bk] = colorMask[bk];
      batchSentValues[bk] = sentValues[bk];
    }

    var payload = {
      action: "translate",
      changedPhrases: batchChangedPhrases,
      colorMask: batchColorMask,
      sentValues: batchSentValues,
      currentVersion: currentVersion,
    };

    console.log("[phrases] Re-translate batch " + (b + 1) + "/" + totalBatches + ": POSTing to: " + PHRASES_FUNCTION_URL);
    var response = UrlFetchApp.fetch(PHRASES_FUNCTION_URL, buildFetchOptions(secret, payload));
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();
    console.log("[phrases] Re-translate batch " + (b + 1) + " response code: " + responseCode);

    if (responseCode === 409) {
      var retryVersion = UrlFetchApp.fetch(PHRASES_FUNCTION_URL + "?versionOnly", {
        method: "get",
        muteHttpExceptions: true,
      });
      if (retryVersion.getResponseCode() !== 200) {
        notify("Batch " + (b + 1) + " of " + totalBatches + " had a version conflict and the version re-fetch failed.\n\n" +
               "Completed " + totalCellCount + " of " + cyanCells.length + " cells. Please retry the remaining selection.");
        return;
      }
      currentVersion = JSON.parse(retryVersion.getContentText()).version;
      payload.currentVersion = currentVersion;
      response = UrlFetchApp.fetch(PHRASES_FUNCTION_URL, buildFetchOptions(secret, payload));
      responseCode = response.getResponseCode();
      responseText = response.getContentText();
      console.log("[phrases] Re-translate batch " + (b + 1) + " retry response code: " + responseCode);
    }

    if (responseCode !== 200) {
      notify("Batch " + (b + 1) + " of " + totalBatches + " failed (" + responseCode + "): " + responseText +
             "\n\nCompleted " + totalCellCount + " of " + cyanCells.length + " cells before failure.");
      return;
    }

    var result = JSON.parse(responseText);
    currentVersion = result.newVersion;

    var writes = planWriteBack(result.translatedRows || {}, rows);
    for (var j = 0; j < writes.length; j++) {
      var w = writes[j];
      try {
        sheet.getRange(w.rowIndex + 1, w.colIndex + 1).setValue(w.value);
      } catch (e) {
        Logger.log("[phrases] Write-back failed for rowIndex=" + w.rowIndex + " colIndex=" + w.colIndex + ": " + e);
      }
    }
    totalCellCount += writes.length;
  }

  notify(
    "Re-translated " +
      totalCellCount +
      " cell(s) across " +
      totalBatches +
      " batch(es). New version: " +
      currentVersion +
      (nonCyanWarning ? "\n\n" + nonCyanWarning : ""),
    "success"
  );
}

// ─── Pure helpers (duplicated here; source of truth: source/appsScript/phrasesPush.js) ──

function extractEnglishMap(rows) {
  if (rows.length < 2) return {};
  var header = rows[0];
  var keyIdx = header.indexOf("language");
  var enIdx = header.indexOf("en");
  if (keyIdx === -1 || enIdx === -1) return {};
  var result = {};
  for (var i = 1; i < rows.length; i++) {
    var key = (rows[i][keyIdx] || "").trim();
    if (key) result[key] = rows[i][enIdx] || "";
  }
  return result;
}

function buildDiffPayload(english, nonCyanValues) {
  return { action: "diff", english: english, nonCyanValues: nonCyanValues };
}

function extractNonTranslatableValues(rows, backgrounds) {
  if (rows.length < 2) return {};
  var header = rows[0];
  var keyIdx = header.indexOf("language");
  var enIdx = header.indexOf("en");
  if (keyIdx === -1 || enIdx === -1) return {};
  var result = {};
  for (var i = 1; i < rows.length; i++) {
    var key = (rows[i][keyIdx] || "").trim();
    if (!key) continue;
    var bgRow = backgrounds[i];
    var rowVals = {};
    for (var h = 0; h < header.length; h++) {
      if (!header[h] || h === keyIdx || h === enIdx) continue;
      if (!isTranslatableBackground(bgRow[h])) {
        rowVals[header[h]] = rows[i][h] || "";
      }
    }
    if (Object.keys(rowVals).length > 0) result[key] = rowVals;
  }
  return result;
}

function isTranslatableBackground(hex) {
  if (!hex) return false;
  return hex.toLowerCase().trim() === "#00ffff"; //cyan color on google sheet
}

function buildTranslatePayload(rows, backgrounds, changedKeys, currentVersion, isFullResync) {
  var header = rows[0];
  var keyIdx = header.indexOf("language");
  var enIdx = header.indexOf("en");
  var targetLangs = [];
  var targetIdxs = [];
  for (var h = 0; h < header.length; h++) {
    if (header[h] && h !== keyIdx && h !== enIdx) {
      targetLangs.push(header[h]);
      targetIdxs.push(h);
    }
  }

  var keyToRowIdx = {};
  for (var i = 1; i < rows.length; i++) {
    var k = (rows[i][keyIdx] || "").trim();
    if (k) keyToRowIdx[k] = i;
  }

  var changedPhrases = {};
  var colorMask = {};
  var sentValues = {};

  for (var c = 0; c < changedKeys.length; c++) {
    var key = changedKeys[c];
    var ri = keyToRowIdx[key];
    if (ri === undefined) continue;
    var row = rows[ri];
    var bgRow = backgrounds[ri];
    changedPhrases[key] = row[enIdx] || "";
    colorMask[key] = {};
    sentValues[key] = {};
    for (var j = 0; j < targetLangs.length; j++) {
      var lang = targetLangs[j];
      var ci = targetIdxs[j];
      colorMask[key][lang] = bgRow[ci];
      sentValues[key][lang] = row[ci] || "";
    }
  }

  return {
    action: isFullResync ? "fullResync" : "translate",
    changedPhrases: changedPhrases,
    colorMask: colorMask,
    sentValues: sentValues,
    currentVersion: currentVersion,
  };
}

function findMissingTranslatableKeys(colorMask, changedKeys) {
  var result = [];
  for (var i = 0; i < changedKeys.length; i++) {
    var key = changedKeys[i];
    var mask = colorMask[key];
    if (!mask) { result.push(key); continue; }
    var values = Object.values(mask);
    if (values.every(function(v) { return v.toLowerCase().trim() !== "#00ffff"; })) result.push(key);
  }
  return result;
}

function planWriteBack(translatedRows, rows) {
  var header = rows[0];
  var keyIdx = header.indexOf("language");
  var enIdx = header.indexOf("en");

  var keyToRowIdx = {};
  for (var i = 1; i < rows.length; i++) {
    var k = (rows[i][keyIdx] || "").trim();
    if (k) keyToRowIdx[k] = i;
  }

  var writes = [];
  var keys = Object.keys(translatedRows);
  for (var ki = 0; ki < keys.length; ki++) {
    var key = keys[ki];
    var ri = keyToRowIdx[key];
    if (ri === undefined) continue;
    var langValues = translatedRows[key];
    var langs = Object.keys(langValues);
    for (var li = 0; li < langs.length; li++) {
      var lang = langs[li];
      var ci = header.indexOf(lang);
      if (ci === -1 || ci === keyIdx || ci === enIdx) continue;
      writes.push({ rowIndex: ri, colIndex: ci, value: langValues[lang] });
    }
  }
  return writes;
}

function buildFetchOptions(secret, payload) {
  return {
    method: "post",
    contentType: "application/json",
    headers: { "x-phrases-secret": secret },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };
}
