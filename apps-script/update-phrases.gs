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
var TRANSLATABLE_BACKGROUND = "#ffffff";

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("EasyEyes")
    .addItem("Retranslate all white cells derived from changed English cells. Then update EasyEyes.", "updatePhrases")
    .addItem("Retranslate the selected white cells. Then update EasyEyes.", "retranslateSelectedCells")
    .addItem("Check all cells. No update.", "checkPhraseKeys")
    .addItem("Compare latest EasyEyes copy with this spreadsheet", "compareLatestEasyEyesCopy")
    .addToUi();
}

function notify(message, type, options) {
  type = type || "warning";
  options = options || {};
  var isSuccess = type === "success";
  var isError = type === "error";

  // Modern color palette
  var colors = isSuccess ? {
    bg: "#f0fdf4",
    accent: "#16a34a",
    text: "#166534",
    border: "#dcfce7",
    hoverDark: "#15803d"
  } : isError ? {
    bg: "#fef2f2",
    accent: "#dc2626",
    text: "#991b1b",
    border: "#fecaca",
    hoverDark: "#b91c1c"
  } : {
    bg: "#fffbeb",
    accent: "#d97706",
    text: "#92400e",
    border: "#fef3c7",
    hoverDark: "#b45309"
  };

  var title = isSuccess ? "Success" : isError ? "Fatal error" : "Warning";
  var safeMsg = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  var billingAction = options.showDeepLBillingAction ? `
        <div class="billing-guidance">
          DeepL rejected the API key. An inactive subscription or billing issue
          is a possible cause. Sign in as <strong>denis.pelli@gmail.com</strong>.
        </div>
        <a
          class="button billing-button"
          href="https://www.deepl.com/en/your-account/billing"
          target="_blank"
          rel="noopener noreferrer"
        >Check DeepL billing</a>
  ` : "";

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
      .billing-guidance {
        color: ` + colors.text + `;
        font-size: 14px;
        line-height: 1.5;
        margin: 0 0 16px;
      }
      .billing-button {
        display: inline-block;
        margin: 0 8px 12px;
        text-decoration: none;
      }
    </style>
    <div class="container">
      <div class="card">
        <div class="icon-wrapper">` + (isSuccess ? "✅" : isError ? "⛔" : "⚠️") + `</div>
        <div class="message">` + safeMsg + `</div>
        ` + billingAction + `
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

function fetchPhraseAuditJson(url, description) {
  var response = UrlFetchApp.fetch(url, {
    method: "get",
    muteHttpExceptions: true,
  });
  var responseCode = response.getResponseCode();
  if (responseCode !== 200) {
    throw new Error(
      "Failed to fetch " + description + " (" + responseCode + ")."
    );
  }
  return JSON.parse(response.getContentText());
}

function compareLatestEasyEyesCopy() {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = spreadsheet.getSheetByName("Translations");
    if (!sheet) {
      notify('Sheet "Translations" not found.');
      return;
    }

    var rows = sheet.getDataRange().getDisplayValues();
    if (rows.length < 2 || rows[0].indexOf("EE_LanguageCode") === -1) {
      notify('No phrase data or required column "EE_LanguageCode" was found.');
      return;
    }

    // Resolve the latest version first, then request that immutable version so
    // the data and publication date always describe the same Firebase copy.
    var metadata = fetchPhraseAuditJson(
      PHRASES_FUNCTION_URL + "?versionOnly=1&audit=" + Date.now(),
      "the latest Firebase phrases version"
    );
    if (!metadata.version) throw new Error("Firebase has no current phrases version.");

    var firebaseCopy = fetchPhraseAuditJson(
      PHRASES_FUNCTION_URL + "?v=" + encodeURIComponent(metadata.version),
      "Firebase phrases version " + metadata.version
    );
    if (!firebaseCopy.phrases) {
      throw new Error("The Firebase phrases response did not contain phrases.");
    }

    var differences = comparePhraseCells(rows, firebaseCopy.phrases);
    var sheetModifiedAt = DriveApp.getFileById(spreadsheet.getId())
      .getLastUpdated()
      .toISOString();
    var html = buildPhraseAuditHtml({
      firebasePublishedAt: metadata.publishedAt || null,
      sheetModifiedAt: sheetModifiedAt,
      sheetUrl: spreadsheet.getUrl(),
      sheetId: sheet.getSheetId(),
      differences: differences,
    });

    SpreadsheetApp.getUi().showModalDialog(
      HtmlService.createHtmlOutput(html).setWidth(1000).setHeight(700),
      "International Phrases audit"
    );
  } catch (error) {
    notify(
      "Could not compare International Phrases with Firebase.\n\n" +
        (error && error.message ? error.message : String(error)),
      "error"
    );
  }
}

function buildPhraseAuditHtml(audit) {
  var safeAuditJson = JSON.stringify(audit)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  var differenceCount = audit.differences.length;

  return `
    <!doctype html>
    <html>
      <head>
        <base target="_blank">
        <style>
          * { box-sizing: border-box; }
          html, body { height: 100%; }
          body {
            margin: 0;
            color: #202124;
            background: #fff;
            font: 14px/1.45 Arial, sans-serif;
          }
          button, a { font: inherit; }
          .audit {
            display: grid;
            grid-template-rows: auto minmax(0, 1fr);
            gap: 16px;
            height: 100%;
            padding: 20px;
          }
          .dates {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }
          .date {
            border: 1px solid #dadce0;
            border-radius: 8px;
            padding: 12px;
          }
          .date strong { display: block; margin-bottom: 4px; }
          .date time { color: #3c4043; }
          .view {
            min-height: 0;
            border-top: 1px solid #dadce0;
            padding-top: 16px;
          }
          .summary, .detail { height: 100%; }
          .summary { display: grid; grid-template-rows: auto minmax(0, 1fr); }
          h1 { margin: 0 0 12px; font-size: 18px; }
          .cell-list {
            align-content: start;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            overflow: auto;
            padding: 2px 4px 16px 2px;
          }
          .cell-button, .back-button {
            border: 1px solid #1a73e8;
            border-radius: 4px;
            color: #1967d2;
            background: #fff;
            cursor: pointer;
            padding: 6px 10px;
          }
          .cell-button:hover, .back-button:hover { background: #e8f0fe; }
          .cell-button:focus-visible, .back-button:focus-visible,
          .sheet-value:focus-visible { outline: 3px solid #8ab4f8; outline-offset: 2px; }
          .empty { color: #5f6368; font-size: 16px; }
          .detail { display: none; grid-template-rows: auto minmax(0, 1fr); gap: 12px; }
          .detail-header { display: flex; align-items: center; gap: 12px; }
          .detail-header h1 { margin: 0; }
          .values {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            min-height: 0;
          }
          .value-panel {
            display: grid;
            grid-template-rows: auto minmax(0, 1fr);
            min-width: 0;
            min-height: 0;
            border: 1px solid #dadce0;
            border-radius: 8px;
            overflow: hidden;
          }
          .value-panel h2 {
            margin: 0;
            padding: 12px;
            border-bottom: 1px solid #dadce0;
            font-size: 15px;
          }
          .value {
            margin: 0;
            overflow: auto;
            padding: 12px;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            font: 14px/1.5 Arial, sans-serif;
          }
          .sheet-value { color: inherit; text-decoration-color: #1a73e8; }
          @media (max-width: 700px) {
            .dates, .values { grid-template-columns: 1fr; }
          }
        </style>
      </head>
      <body>
        <main class="audit">
          <section class="dates" aria-label="Source dates">
            <div class="date">
              <strong>Firebase copy</strong>
              <time id="firebase-date"></time>
            </div>
            <div class="date">
              <strong>International Phrases spreadsheet</strong>
              <time id="sheet-date"></time>
            </div>
          </section>
          <section class="view">
            <div class="summary" id="summary">
              <h1>Differing cells: ` + differenceCount + `</h1>
              <div class="cell-list" id="cell-list"></div>
            </div>
            <div class="detail" id="detail">
              <div class="detail-header">
                <button class="back-button" id="back" type="button">Back to list</button>
                <h1 id="detail-title"></h1>
              </div>
              <div class="values">
                <section class="value-panel">
                  <h2>Firebase copy</h2>
                  <pre class="value" id="firebase-value"></pre>
                </section>
                <section class="value-panel">
                  <h2>International Phrases spreadsheet — click to edit</h2>
                  <a class="value sheet-value" id="sheet-value" target="_blank" rel="noopener noreferrer"></a>
                </section>
              </div>
            </div>
          </section>
        </main>
        <script>
          var audit = ` + safeAuditJson + `;

          function formatLocalDate(iso) {
            if (!iso) return "Unavailable";
            var date = new Date(iso);
            if (isNaN(date.getTime())) return "Unavailable";
            var offsetMinutes = -date.getTimezoneOffset();
            var sign = offsetMinutes >= 0 ? "+" : "-";
            var absolute = Math.abs(offsetMinutes);
            var offset = sign + String(Math.floor(absolute / 60)).padStart(2, "0") +
              ":" + String(absolute % 60).padStart(2, "0");
            return date.toLocaleString() + " (UTC" + offset + ")";
          }

          document.getElementById("firebase-date").textContent =
            formatLocalDate(audit.firebasePublishedAt);
          document.getElementById("sheet-date").textContent =
            formatLocalDate(audit.sheetModifiedAt);

          var list = document.getElementById("cell-list");
          if (audit.differences.length === 0) {
            var empty = document.createElement("p");
            empty.className = "empty";
            empty.textContent = "The Firebase copy and spreadsheet have no differing cells.";
            list.appendChild(empty);
          } else {
            var fragment = document.createDocumentFragment();
            audit.differences.forEach(function (difference, index) {
              var button = document.createElement("button");
              button.className = "cell-button";
              button.type = "button";
              button.textContent = difference.coordinate;
              button.setAttribute("aria-label", "Inspect differing cell " + difference.coordinate);
              button.addEventListener("click", function () { showDetail(index); });
              fragment.appendChild(button);
            });
            list.appendChild(fragment);
          }

          function showDetail(index) {
            var difference = audit.differences[index];
            document.getElementById("detail-title").textContent =
              "Differing cell: " + difference.coordinate;
            document.getElementById("firebase-value").textContent = difference.firebaseValue;
            var sheetValue = document.getElementById("sheet-value");
            sheetValue.textContent = difference.sheetValue;
            sheetValue.href = audit.sheetUrl.split("#")[0] + "#gid=" + audit.sheetId +
              "&range=" + encodeURIComponent(difference.coordinate);
            document.getElementById("summary").style.display = "none";
            document.getElementById("detail").style.display = "grid";
            document.getElementById("back").focus();
          }

          document.getElementById("back").addEventListener("click", function () {
            document.getElementById("detail").style.display = "none";
            document.getElementById("summary").style.display = "grid";
          });
        </script>
      </body>
    </html>`;
}

function showSpinner() {
  CacheService.getUserCache().remove('spinnerProgress');
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
      .container { text-align: center; padding: 24px 32px; }
      .spinner {
        width: 44px;
        height: 44px;
        border: 4px solid #e5e7eb;
        border-top-color: #2563eb;
        border-radius: 50%;
        animation: spin 0.75s linear infinite;
        margin: 0 auto 14px;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      .label { font-size: 14px; color: #374151; letter-spacing: 0.1px; }
      .progress { font-size: 12px; color: #6b7280; margin-top: 6px; min-height: 18px; }
    </style>
    <div class="container">
      <div class="spinner"></div>
      <div class="label">Translating…</div>
      <div class="progress" id="progress"></div>
    </div>
    <script>
      function poll() {
        google.script.run
          .withSuccessHandler(function(text) {
            document.getElementById('progress').textContent = text || '';
            setTimeout(poll, 500);
          })
          .withFailureHandler(function() { setTimeout(poll, 500); })
          .getSpinnerProgress();
      }
      poll();
    </script>
  `;
  try {
    SpreadsheetApp.getUi().showModelessDialog(
      HtmlService.createHtmlOutput(html).setHeight(155).setWidth(200),
      "Translating …"
    );
  } catch (e) {
    Logger.log("[phrases] showSpinner");
  }
}

function getSpinnerProgress() {
  return CacheService.getUserCache().get('spinnerProgress') || '';
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
  var activeLanguages = extractActiveLanguages(rows);

  // Pre-flight: refuse to update if any phrase key is duplicated.
  var duplicateKeys = findDuplicateKeys(rows);
  if (duplicateKeys.length > 0) {
    notify(
      "EasyEyes was NOT updated.\n\n" +
        "The International Phrases has duplicate phrase keys. Each key must be " +
        "unique. Please remove or rename the following duplicate key(s) and " +
        "try again:\n\n" +
        duplicateKeys.join("\n")
    );
    return;
  }

  // Phase 1: diff (English changes only)
  var english = extractEnglishMap(rows);
  var diffPayload = buildDiffPayload(english);
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
  var removedKeys = diffResult.removed || [];
  var currentVersion = diffResult.currentVersion;

  // Non-white step: send all non-white cell values once; the API stores any that
  // differ from what is already in Firebase.
  var nonWhitePhrases = extractNonTranslatableValues(rows, backgrounds);
  var nonWhiteChanged = false;

  if (
    Object.keys(nonWhitePhrases).length > 0 ||
    removedKeys.length > 0 ||
    activeLanguages.length > 0
  ) {
    var nonWhitePayload = {
      action: "translate",
      changedPhrases: {},
      removedKeys: removedKeys,
      colorMask: {},
      sentValues: {},
      // Keep the legacy field name for compatibility with the phrases API.
      nonCyanPhrases: nonWhitePhrases,
      activeLanguages: activeLanguages,
      currentVersion: currentVersion,
    };
    console.log("[phrases] Non-white step: POSTing to: " + PHRASES_FUNCTION_URL);
    var nonWhiteResponse = UrlFetchApp.fetch(PHRASES_FUNCTION_URL, buildFetchOptions(secret, nonWhitePayload));
    var nonWhiteCode = nonWhiteResponse.getResponseCode();
    var nonWhiteText = nonWhiteResponse.getContentText();
    console.log("[phrases] Non-white step response code: " + nonWhiteCode);

    if (nonWhiteCode === 409) {
      var retryVersionResponse = UrlFetchApp.fetch(PHRASES_FUNCTION_URL + "?versionOnly", {
        method: "get",
        muteHttpExceptions: true,
      });
      if (retryVersionResponse.getResponseCode() !== 200) {
        notify("Non-white update had a version conflict and the version re-fetch failed. Please try again.");
        return;
      }
      currentVersion = JSON.parse(retryVersionResponse.getContentText()).version;
      nonWhitePayload.currentVersion = currentVersion;
      nonWhiteResponse = UrlFetchApp.fetch(PHRASES_FUNCTION_URL, buildFetchOptions(secret, nonWhitePayload));
      nonWhiteCode = nonWhiteResponse.getResponseCode();
      nonWhiteText = nonWhiteResponse.getContentText();
      console.log("[phrases] Non-white step retry response code: " + nonWhiteCode);
    }

    if (nonWhiteCode !== 200) {
      notify("Non-white values update failed (" + nonWhiteCode + "): " + nonWhiteText);
      return;
    }

    var nonWhiteResult = JSON.parse(nonWhiteText);
    if (nonWhiteResult.newVersion !== currentVersion) {
      nonWhiteChanged = true;
      currentVersion = nonWhiteResult.newVersion;
    }
  }

  if (!changedKeys || changedKeys.length === 0) {
    if (nonWhiteChanged) {
      notify("Phrases updated. New version: " + currentVersion, "success");
    } else {
      notify("Phrases are up to date. No changes detected.", "success");
    }
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
  var activeLanguages = translatePayload.activeLanguages;

  var BATCH_SIZE = 50;
  var allKeys = Object.keys(changedPhrases);
  var totalBatches = Math.ceil(allKeys.length / BATCH_SIZE);
  var totalCellCount = 0;
  var newVersion = currentVersion;

  showSpinner();
  for (var b = 0; b < totalBatches; b++) {
    if (totalBatches > 1) {
      CacheService.getUserCache().put('spinnerProgress', (b * BATCH_SIZE) + " of " + allKeys.length + " phrases done", 60);
    }
    var batchKeys = allKeys.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);

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
      activeLanguages: activeLanguages,
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
      var translateFailure = classifyPhrasesApiFailure(translateText);
      notify("EasyEyes was NOT updated. No new phrases version was created.\n\n" +
             "Batch " + (b + 1) + " of " + totalBatches + " failed (" + translateCode + "): " + translateFailure.message +
             "\n\nCompleted " + totalCellCount + " cell(s) before failure.",
             translateFailure.isFatal ? "error" : "warning",
             { showDeepLBillingAction: translateFailure.showDeepLBillingAction });
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
      "Warning: the following phrase keys have no translatable (white) " +
        "target-language cells and were not translated:\n" +
        missingKeys.join(", ")
    );
  } else {
    var label = isFullResync ? "Full Resync" : "update";
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
  var activeLanguages = extractActiveLanguages(rows);

  if (rows.length < 2) {
    notify("No data found in the International Phrases.");
    return;
  }

  var header = rows[0];
  var keyIdx = header.indexOf("EE_LanguageCode");
  var enIdx = header.indexOf("en");
  if (keyIdx === -1 || enIdx === -1) {
    notify('Required columns "EE_LanguageCode" and "en" not found in header row.');
    return;
  }

  var rangeList = sheet.getActiveRangeList();
  if (!rangeList) {
    notify("No cells selected.");
    return;
  }
  var ranges = rangeList.getRanges();

  var nonWhiteCells = [];
  var whiteCells = [];

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
          whiteCells.push({
            rowIdx: rowIdx,
            colIdx: colIdx,
            key: key,
            lang: lang,
            engText: rows[rowIdx][enIdx] || "",
            currentValue: rows[rowIdx][colIdx] || "",
          });
        } else {
          nonWhiteCells.push({ sheetRow: startRow + dr, lang: lang });
        }
      }
    }
  }

  var nonWhiteWarning =
    nonWhiteCells.length > 0
      ? "Skipped " + nonWhiteCells.length +
        " non-white cells. Change their background to white to include them."
      : "";

  if (whiteCells.length === 0) {
    notify(
      "No translatable cells found in selection." +
        (nonWhiteWarning ? "\n\n" + nonWhiteWarning : "")
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

  for (var i = 0; i < whiteCells.length; i++) {
    var cell = whiteCells[i];
    if (!changedPhrases[cell.key]) {
      changedPhrases[cell.key] = cell.engText;
      colorMask[cell.key] = {};
      sentValues[cell.key] = {};
    }
    colorMask[cell.key][cell.lang] = TRANSLATABLE_BACKGROUND;
    sentValues[cell.key][cell.lang] = cell.currentValue;
  }

  var BATCH_SIZE = 50;
  var allKeys = Object.keys(changedPhrases);
  var totalBatches = Math.ceil(allKeys.length / BATCH_SIZE);
  var totalCellCount = 0;

  showSpinner();
  for (var b = 0; b < totalBatches; b++) {
    if (totalBatches > 1) {
      CacheService.getUserCache().put('spinnerProgress', (b * BATCH_SIZE) + " of " + allKeys.length + " phrases done", 60);
    }
    var batchKeys = allKeys.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);

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
      activeLanguages: activeLanguages,
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
               "Completed " + totalCellCount + " of " + whiteCells.length + " cells. Please retry the remaining selection.");
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
      var responseFailure = classifyPhrasesApiFailure(responseText);
      notify("EasyEyes was NOT updated. No new phrases version was created.\n\n" +
             "Batch " + (b + 1) + " of " + totalBatches + " failed (" + responseCode + "): " + responseFailure.message +
             "\n\nCompleted " + totalCellCount + " of " + whiteCells.length + " cells before failure.",
             responseFailure.isFatal ? "error" : "warning",
             { showDeepLBillingAction: responseFailure.showDeepLBillingAction });
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
    "Translated " +
      totalCellCount +
      " cell(s). New version: " +
      currentVersion +
      (nonWhiteWarning ? "\n\n⚠️ " + nonWhiteWarning : ""),
    "success"
  );
}

function extractPhrasesApiError(responseText) {
  try {
    return JSON.parse(responseText).error || responseText;
  } catch (e) {
    return responseText;
  }
}

function classifyPhrasesApiFailure(responseText) {
  var parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch (e) {
    parsed = null;
  }

  var isDeepLFailure =
    parsed &&
    parsed.code === "DEEPL_TRANSLATION_FAILED" &&
    parsed.fatal === true;

  return {
    message:
      (parsed && parsed.error ? parsed.error : responseText) +
      (parsed && parsed.technicalDetail
        ? "\n\nTechnical detail: " + parsed.technicalDetail
        : ""),
    isFatal: Boolean(isDeepLFailure),
    showDeepLBillingAction:
      Boolean(isDeepLFailure) && parsed.deeplStatus === 403,
  };
}

function checkPhraseKeys() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Translations");
  if (!sheet) {
    notify('Sheet "Translations" not found.');
    return;
  }

  var dataRange = sheet.getDataRange();
  var rows = dataRange.getDisplayValues();
  var backgrounds = dataRange.getBackgrounds();
  if (rows.length < 2) {
    notify("No data found in the International Phrases.");
    return;
  }

  if (rows[0].indexOf("EE_LanguageCode") === -1) {
    notify('Required column "EE_LanguageCode" not found in header row.');
    return;
  }

  // Each check returns a report section, or "" when it finds nothing.
  // Comment out any line below to disable that individual check.
  var sections = [];
  sections.push(checkExactDuplicateKeys(rows));
  sections.push(checkKeyLeadingTrailingSpaces(rows));
  sections.push(checkKeyInvisibleChars(rows));
  sections.push(checkKeyInteriorSpaces(rows));
  sections.push(checkDuplicateLanguageColumns(rows));
  sections.push(checkKeyNamingConvention(rows));
  sections.push(checkMissingEnglishSource(rows));
  sections.push(checkEmptyTranslationCells(rows, backgrounds));
  sections.push(checkOrphanRows(rows));
  sections.push(checkDuplicateEnglishText(rows));

  sections = sections.filter(function (s) { return s; });

  if (sections.length === 0) {
    notify("No potential problems found in the International Phrases.", "success");
    return;
  }

  notify("Found potential problems in the International Phrases:\n\n" + sections.join("\n\n"));
}

// ─── Individual phrase-key checks (each returns a report section, or "") ──────

// Same trimmed key in more than one row. Only one row gets the translation;
// the others are left blank.
function checkExactDuplicateKeys(rows) {
  var keyIdx = rows[0].indexOf("EE_LanguageCode");
  if (keyIdx === -1) return "";
  var rowsByKey = {};
  for (var i = 1; i < rows.length; i++) {
    var key = (rows[i][keyIdx] || "").trim();
    if (!key) continue;
    if (!rowsByKey[key]) rowsByKey[key] = [];
    rowsByKey[key].push(i + 1);
  }
  var lines = [];
  Object.keys(rowsByKey).forEach(function (k) {
    if (rowsByKey[k].length > 1) lines.push(k);
  });
  if (!lines.length) return "";
  return "Duplicate keys (exact). Only one row receives the translation; the " +
    "others are left blank:\n" + lines.sort().join("\n");
}

// Returns the sorted list of trimmed keys that appear in more than one row.
// Used as a hard pre-flight gate before pushing phrases to EasyEyes.
function findDuplicateKeys(rows) {
  if (rows.length < 2) return [];
  var keyIdx = rows[0].indexOf("EE_LanguageCode");
  if (keyIdx === -1) return [];
  var counts = {};
  for (var i = 1; i < rows.length; i++) {
    var key = (rows[i][keyIdx] || "").trim();
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  var dups = [];
  Object.keys(counts).forEach(function (k) {
    if (counts[k] > 1) dups.push(k);
  });
  return dups.sort();
}

// Keys with leading/trailing spaces. Trimmed before use, so they silently
// collide with the un-spaced spelling.
function checkKeyLeadingTrailingSpaces(rows) {
  var keyIdx = rows[0].indexOf("EE_LanguageCode");
  if (keyIdx === -1) return "";
  var lines = [];
  for (var i = 1; i < rows.length; i++) {
    var raw = rows[i][keyIdx] || "";
    var key = raw.trim();
    if (!key) continue;
    if (raw !== key) lines.push('"' + raw + '"');
  }
  if (!lines.length) return "";
  return "Keys with leading/trailing spaces (trimmed before use, so they collide " +
    "with the un-spaced spelling):\n" + lines.sort().join("\n");
}

// Keys containing invisible / look-alike characters that survive .trim() and
// make a key look identical to another while never matching it.
function checkKeyInvisibleChars(rows) {
  var keyIdx = rows[0].indexOf("EE_LanguageCode");
  if (keyIdx === -1) return "";
  var suspects = [
    { name: "non-breaking space", re: /\u00A0/ },
    { name: "zero-width space", re: /[\u200B-\u200D\uFEFF]/ },
    { name: "tab", re: /\t/ },
  ];
  var lines = [];
  for (var i = 1; i < rows.length; i++) {
    var key = (rows[i][keyIdx] || "").trim();
    if (!key) continue;
    var found = [];
    for (var s = 0; s < suspects.length; s++) {
      if (suspects[s].re.test(key)) found.push(suspects[s].name);
    }
    if (found.length) lines.push(key + " (" + found.join(", ") + ")");
  }
  if (!lines.length) return "";
  return "Keys containing invisible/look-alike characters (they never match the " +
    "visually identical key):\n" + lines.sort().join("\n");
}

// Keys with a regular space somewhere inside the trimmed key (e.g. "my key").
function checkKeyInteriorSpaces(rows) {
  var keyIdx = rows[0].indexOf("EE_LanguageCode");
  if (keyIdx === -1) return "";
  var lines = [];
  for (var i = 1; i < rows.length; i++) {
    var key = (rows[i][keyIdx] || "").trim();
    if (!key) continue;
    if (key.indexOf(" ") !== -1) lines.push(key);
  }
  if (!lines.length) return "";
  return "Keys containing interior spaces (almost always a typo):\n" + lines.sort().join("\n");
}

// Two or more target columns sharing the same header. Write-back uses
// header.indexOf(lang), so only the first such column is ever written.
function checkDuplicateLanguageColumns(rows) {
  var header = rows[0];
  var firstSeen = {}; // name -> first column number
  var dups = {};      // name -> [column numbers]
  for (var h = 0; h < header.length; h++) {
    var name = (header[h] || "").trim();
    if (!name) continue;
    if (firstSeen[name] !== undefined) {
      if (!dups[name]) dups[name] = [firstSeen[name]];
      dups[name].push(h + 1);
    } else {
      firstSeen[name] = h + 1;
    }
  }
  var lines = [];
  Object.keys(dups).forEach(function (n) {
    lines.push(n + " — columns " + dups[n].join(", "));
  });
  if (!lines.length) return "";
  return "Duplicate column headers. Only the first column is written; the rest are " +
    "ignored on write-back:\n" + lines.sort().join("\n");
}

// Keys that do not start with one of the project's expected prefixes.
function checkKeyNamingConvention(rows) {
  var ALLOWED_PREFIXES = ["EE_", "RC_", "T_", "x", "_DOCUMENTATION_OF_THIS_TABLE"]; // edit to match the project's key prefixes
  var keyIdx = rows[0].indexOf("EE_LanguageCode");
  if (keyIdx === -1) return "";
  var lines = [];
  for (var i = 1; i < rows.length; i++) {
    var key = (rows[i][keyIdx] || "").trim();
    if (!key) continue;
    var ok = ALLOWED_PREFIXES.some(function (p) { return key.indexOf(p) === 0; });
    if (!ok) lines.push(key);
  }
  if (!lines.length) return "";
  return "Keys not starting with an expected prefix (" + ALLOWED_PREFIXES.join(", ") +
    "):\n" + lines.sort().join("\n");
}

// Keys whose English (en) source cell is empty — nothing to translate.
function checkMissingEnglishSource(rows) {
  var keyIdx = rows[0].indexOf("EE_LanguageCode");
  var enIdx = rows[0].indexOf("en");
  if (keyIdx === -1 || enIdx === -1) return "";
  var lines = [];
  for (var i = 1; i < rows.length; i++) {
    var key = (rows[i][keyIdx] || "").trim();
    if (!key) continue;
    if (!(rows[i][enIdx] || "").trim()) lines.push(key);
  }
  if (!lines.length) return "";
  return "Keys with an empty English (en) source cell (nothing to translate):\n" +
    lines.sort().join("\n");
}

// Empty white target-language cells may indicate that translation failed.
// Non-white cells are excluded because they are intentionally not translated.
function checkEmptyTranslationCells(rows, backgrounds) {
  var header = rows[0];
  var keyIdx = header.indexOf("EE_LanguageCode");
  var enIdx = header.indexOf("en");
  if (keyIdx === -1 || enIdx === -1) return "";
  var lines = [];
  for (var i = 1; i < rows.length; i++) {
    var key = (rows[i][keyIdx] || "").trim();
    if (!key) continue;
    for (var h = 0; h < header.length; h++) {
      var language = (header[h] || "").trim();
      if (!language || h === keyIdx || h === enIdx) continue;
      if (!isTranslatableBackground(backgrounds[i] && backgrounds[i][h])) continue;
      if ((rows[i][h] || "").trim()) continue;

      lines.push(key + " — " + language);
    }
  }
  if (!lines.length) return "";
  return "Empty translatable cells (possible failed translations):\n" +
    lines.sort().join("\n");
}

// Rows that have content in some column but no key — silently skipped on every
// push, so their text never reaches the app.
function checkOrphanRows(rows) {
  var keyIdx = rows[0].indexOf("EE_LanguageCode");
  if (keyIdx === -1) return "";
  var lines = [];
  for (var i = 1; i < rows.length; i++) {
    if ((rows[i][keyIdx] || "").trim()) continue;
    var hasContent = false;
    for (var h = 0; h < rows[i].length; h++) {
      if (h === keyIdx) continue;
      if ((rows[i][h] || "").trim()) { hasContent = true; break; }
    }
    if (hasContent) lines.push("row " + (i + 1));
  }
  if (!lines.length) return "";
  return "Rows with content but no key in the EE_LanguageCode column (silently skipped on " +
    "every push):\n" + lines.join("\n");
}

// Identical English source text under different keys — possible redundancy.
function checkDuplicateEnglishText(rows) {
  var keyIdx = rows[0].indexOf("EE_LanguageCode");
  var enIdx = rows[0].indexOf("en");
  if (keyIdx === -1 || enIdx === -1) return "";
  var keysByText = {}; // en text -> { key: true }
  var rowsByText = {}; // en text -> [rows]
  for (var i = 1; i < rows.length; i++) {
    var key = (rows[i][keyIdx] || "").trim();
    if (!key) continue;
    var text = (rows[i][enIdx] || "").trim();
    if (!text) continue;
    if (!keysByText[text]) { keysByText[text] = {}; rowsByText[text] = []; }
    keysByText[text][key] = true;
    rowsByText[text].push(i + 1);
  }
  var lines = [];
  Object.keys(keysByText).forEach(function (t) {
    var keys = Object.keys(keysByText[t]);
    if (keys.length > 1) {
      lines.push(keys.join(", "));
    }
  });
  if (!lines.length) return "";
  return "Identical English text under different keys (possible redundancy):\n" +
    lines.sort().join("\n\n");
}

// ─── Pure helpers (duplicated here; source of truth: source/appsScript/phrasesPush.js) ──

function extractEnglishMap(rows) {
  if (rows.length < 2) return {};
  var header = rows[0];
  var keyIdx = header.indexOf("EE_LanguageCode");
  var enIdx = header.indexOf("en");
  if (keyIdx === -1 || enIdx === -1) return {};
  var result = {};
  for (var i = 1; i < rows.length; i++) {
    var key = (rows[i][keyIdx] || "").trim();
    if (key) result[key] = rows[i][enIdx] || "";
  }
  return result;
}

function buildDiffPayload(english) {
  return { action: "diff", english: english };
}

function toA1Coordinate(column, row) {
  var letters = "";
  var current = column;
  while (current > 0) {
    var remainder = (current - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    current = Math.floor((current - 1) / 26);
  }
  return letters + row;
}

function comparePhraseCells(rows, firebasePhrases) {
  if (rows.length < 2) return [];
  var header = rows[0];
  var keyIdx = header.indexOf("EE_LanguageCode");
  if (keyIdx === -1) return [];
  var phrases = firebasePhrases || {};
  var differences = [];

  for (var rowIdx = 1; rowIdx < rows.length; rowIdx++) {
    var rawKey = rows[rowIdx][keyIdx] || "";
    var key = rawKey.trim();
    if (!key) continue;
    var firebaseRow = phrases[key];

    for (var colIdx = 0; colIdx < header.length; colIdx++) {
      var sheetValue = rows[rowIdx][colIdx] || "";
      var firebaseValue = "";

      if (firebaseRow) {
        if (colIdx === keyIdx) firebaseValue = key;
        else if (header[colIdx]) firebaseValue = firebaseRow[header[colIdx]] || "";
      }

      if (sheetValue !== firebaseValue) {
        differences.push({
          coordinate: toA1Coordinate(colIdx + 1, rowIdx + 1),
          firebaseValue: firebaseValue,
          sheetValue: sheetValue,
        });
      }
    }
  }

  return differences;
}

function extractActiveLanguages(rows) {
  if (rows.length === 0) return [];
  var header = rows[0];
  var keyIdx = header.indexOf("EE_LanguageCode");
  var result = [];
  for (var h = 0; h < header.length; h++) {
    var language = (header[h] || "").trim();
    if (language && h !== keyIdx) result.push(language);
  }
  return result;
}

function extractNonTranslatableValues(rows, backgrounds) {
  if (rows.length < 2) return {};
  var header = rows[0];
  var keyIdx = header.indexOf("EE_LanguageCode");
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
  return hex.toLowerCase().trim() === TRANSLATABLE_BACKGROUND;
}

function buildTranslatePayload(rows, backgrounds, changedKeys, currentVersion, isFullResync) {
  var header = rows[0];
  var keyIdx = header.indexOf("EE_LanguageCode");
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
    activeLanguages: extractActiveLanguages(rows),
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
    if (values.every(function(v) { return !isTranslatableBackground(v); })) result.push(key);
  }
  return result;
}

function planWriteBack(translatedRows, rows) {
  var header = rows[0];
  var keyIdx = header.indexOf("EE_LanguageCode");
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
