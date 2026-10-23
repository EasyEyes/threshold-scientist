const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

test("upload manifests include runtime chunks and exclude development files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "easyeyes-manifest-"));
  try {
    for (const dir of [
      "threshold/js",
      "threshold/preprocess",
      "source/components",
      "threshold/tools",
      "threshold/threshold-engine/runtime",
      "threshold/psychojs",
    ]) {
      fs.mkdirSync(path.join(root, dir), { recursive: true });
    }
    for (const file of [
      "js/runtime.js",
      "js/runtime.min.js.map",
      ".nvmrc",
      "psychojs/.nvmrc",
      "CONTEXT.md",
      "tools/private.ts",
      "threshold-engine/runtime/duplicate.js",
    ]) {
      fs.writeFileSync(path.join(root, "threshold", file), "");
    }
    execFileSync(
      process.execPath,
      [path.join(__dirname, "writeAllFilePaths.js")],
      { cwd: root },
    );
    const participant = fs.readFileSync(
      path.join(root, "threshold/preprocess/files.ts"),
      "utf8",
    );
    assert.equal(
      participant,
      fs.readFileSync(path.join(root, "source/components/files.ts"), "utf8"),
    );
    assert.match(participant, /"js\/runtime.js"/);
    assert.match(participant, /"js\/runtime.min.js.map"/);
    assert.doesNotMatch(
      participant,
      /\.nvmrc|CONTEXT.md|private.ts|duplicate.js/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
