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
    .addItem("Update Phrases", "updatePhrases")
    .addItem("Full Resync Phrases", "fullResyncPhrases")
    .addToUi();
}

function notify(message) {
  try {
    SpreadsheetApp.getUi().alert(message);
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
    notify("Phrases are up to date. No changes detected.");
    return;
  }

  // Phase 2: translate / fullResync
  var translatePayload = buildTranslatePayload(
    rows,
    backgrounds,
    changedKeys,
    currentVersion,
    isFullResync
  );
  var translateOptions = buildFetchOptions(secret, translatePayload);

  console.log("[phrases] Phase 2: POSTing translate to: " + PHRASES_FUNCTION_URL);
  var translateResponse = UrlFetchApp.fetch(PHRASES_FUNCTION_URL, translateOptions);
  var translateCode = translateResponse.getResponseCode();
  var translateText = translateResponse.getContentText();
  console.log("[phrases] Phase 2 response code: " + translateCode);

  if (translateCode === 409) {
    notify(
      "Phrases push aborted: another push modified the phrases while this one was running. " +
        "Please try again."
    );
    return;
  }

  if (translateCode === 400) {
    var errMsg = "";
    try {
      errMsg = JSON.parse(translateText).error || translateText;
    } catch (e) {
      errMsg = translateText;
    }
    notify("Phrases push rejected: " + errMsg);
    return;
  }

  if (translateCode !== 200) {
    notify("Phrases translate failed (" + translateCode + "): " + translateText);
    return;
  }

  var translateResult = JSON.parse(translateText);
  var translatedRows = translateResult.translatedRows || {};

  // Write-back: update target-language cells only
  var writes = planWriteBack(translatedRows, rows);
  for (var i = 0; i < writes.length; i++) {
    var w = writes[i];
    try {
      // Sheet rows and columns are 1-indexed; our indices are 0-indexed
      sheet.getRange(w.rowIndex + 1, w.colIndex + 1).setValue(w.value);
    } catch (e) {
      Logger.log("[phrases] Write-back failed for rowIndex=" + w.rowIndex + " colIndex=" + w.colIndex + ": " + e);
    }
  }

  // Warning: keys with no translatable target cells
  var colorMask = translatePayload.colorMask;
  var missingKeys = findMissingTranslatableKeys(colorMask, changedKeys);
  if (missingKeys.length > 0) {
    notify(
      "Warning: the following phrase keys have no translatable (cyan) " +
        "target-language cells and were not translated:\n" +
        missingKeys.join(", ")
    );
  } else {
    var label = isFullResync ? "Full Resync" : "Update";
    notify("Phrases " + label + " complete. New version: " + translateResult.newVersion);
  }
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
      colorMask[key][lang] = isTranslatableBackground(bgRow[ci]);
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
    if (values.every(function(v) { return !v; })) result.push(key);
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
