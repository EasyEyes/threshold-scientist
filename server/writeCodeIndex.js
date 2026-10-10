/*
  Writes studio-code-index.json — the map of the EasyEyes source that the
  Studio assistant's opt-in "Code lookup" skill searches and reads
  (source/studio/assistant/codeSkill.ts).

  The site publishes docs/ as-is, so every source file under docs/experiment
  is already served at /compiler/<path>; what the browser lacks is a listing.
  This script walks the source, and for each file records its path, size,
  line count, the first sentence of its leading comment and its top-level
  symbol names (exports, functions, classes, headings), so the assistant can
  find the right file before it downloads it.

  Generated at dev start and at build (`npm start`, `npm run netlify`), not
  committed. Run `npm run code-index` to refresh by hand.
*/
const fs = require("fs");
const path = require("path");

/** Where to look, and what each area is for (shown to the model). */
const ROOTS = [
  {
    dir: "source",
    about:
      "The compiler web app (React) and EasyEyes Studio: table editor, Study Builder (recipes, knobs), the assistant itself",
  },
  {
    dir: "threshold/preprocess",
    about:
      "The compiler: reads the experiment table, validates it (validateExperimentTable.ts, experimentFileChecks.ts), checks resources and fonts, uploads to Pavlovia/GitLab",
  },
  {
    dir: "threshold/parameters",
    about:
      "Glossary registry and paramReader (how the runtime reads a parameter's value per condition)",
  },
  {
    dir: "threshold/components",
    about:
      "The experiment runtime: stimuli, crowding and acuity geometry, QUEST, reading and RSVP, fixation, calibration (screen, distance, gaze, sound), responses, saving",
  },
  {
    dir: "threshold/psychojs",
    about: "EasyEyes' patched PsychoJS: rendering, scheduling, data saving",
  },
  {
    dir: "threshold/tools",
    about: "Developer tools: table repair, luminance measurement",
  },
  {
    dir: "threshold/server",
    about:
      "Node-side scripts: participant simulation, runtime publishing, file manifest checks",
  },
];

/** Single files outside the roots that are worth reading. */
const EXTRA_FILES = [
  "README.md",
  "LESSONS-LEARNED.md",
  "threshold/README.md",
  "threshold/CONTEXT.md",
  "threshold/threshold.js",
  "threshold/first.js",
  "threshold/index.html",
];

const EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".md",
  ".html",
  ".css",
]);

/** Directory names skipped wherever they occur. */
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "tests",
  "__tests__",
  "__mocks__",
  "test-results",
  "legacy",
  "fuzz",
  "out",
  "docs",
  "scripts",
  "patches",
  ".git",
]);

const skipFile = (file) =>
  file.startsWith(".") ||
  /\.d\.ts$/.test(file) ||
  /\.min\.js$/.test(file) ||
  /\.map$/.test(file) ||
  /\.(test|spec)\.[cm]?[jt]sx?$/.test(file) ||
  /^(CHANGELOG|CONTRIBUTING|LICENSE|code-of-conduct)\.md$/i.test(file) ||
  file === "files.ts" || // generated: the Pavlovia upload manifest
  file === "studio-code-index.json";

const MAX_SYMBOLS = 60;
const MAX_HEAD = 160;

const SYMBOL_PATTERNS = [
  /^export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|class|const|let|var|interface|type|enum|abstract\s+class)\s+([A-Za-z_$][\w$]*)/,
  /^(?:async\s+)?function\*?\s+([A-Za-z_$][\w$]*)/,
  /^(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/,
  /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]*)?=/,
];

/** Top-level names: declarations at column 0, `export { a, b }`, md headings. */
function symbolsOf(lines, ext) {
  const out = [];
  const seen = new Set();
  const add = (name) => {
    if (!name || seen.has(name) || out.length >= MAX_SYMBOLS) return;
    seen.add(name);
    out.push(name);
  };
  if (ext === ".md") {
    for (const line of lines) {
      const m = line.match(/^#{1,3}\s+(.+?)\s*#*\s*$/);
      if (m) add(m[1].trim());
    }
    return out;
  }
  if (ext === ".html" || ext === ".css") return out;
  for (const line of lines) {
    for (const re of SYMBOL_PATTERNS) {
      const m = line.match(re);
      if (m) {
        add(m[1]);
        break;
      }
    }
    const list = line.match(/^export\s*\{([^}]*)\}/);
    if (list)
      for (const part of list[1].split(","))
        add(
          part
            .trim()
            .split(/\s+as\s+/)
            .pop()
            .trim(),
        );
  }
  return out;
}

const firstSentence = (text) => {
  const plain = text.replace(/\s+/g, " ").trim();
  const m = plain.match(/^.*?[.!?](\s|$)/);
  const s = (m ? m[0] : plain).trim();
  return s.length > MAX_HEAD ? s.slice(0, MAX_HEAD - 1) + "…" : s;
};

/** The first sentence of the leading comment (or heading, or line). */
function headOf(lines, ext) {
  const top = lines.slice(0, 40);
  if (ext === ".md") {
    const body = top.find((l) => l.trim() && !/^#/.test(l.trim()));
    const heading = top.find((l) => /^#/.test(l.trim()));
    return firstSentence(
      (body ?? heading ?? "").replace(/^#+\s*/, "").replace(/[*_`]/g, ""),
    );
  }
  const text = [];
  let inBlock = false;
  for (const raw of top) {
    const line = raw.trim();
    if (!inBlock && !text.length && line === "") continue;
    if (!inBlock && /^\/\*/.test(line)) {
      inBlock = true;
      const inner = line.replace(/^\/\*+/, "").replace(/\*+\/.*$/, "");
      text.push(inner);
      if (/\*\//.test(line)) break;
      continue;
    }
    if (inBlock) {
      if (/\*\//.test(line)) {
        text.push(line.replace(/\*+\/.*$/, "").replace(/^\*\s?/, ""));
        break;
      }
      text.push(line.replace(/^\*\s?/, ""));
      continue;
    }
    if (/^\/\//.test(line)) {
      text.push(line.replace(/^\/\/\s?/, ""));
      continue;
    }
    break;
  }
  const comment = text
    .map((t) => t.trim())
    .filter((t) => t && !/^(eslint|@ts-|prettier|tslint)/.test(t))
    .join(" ");
  if (comment) return firstSentence(comment);
  // No leading comment: nothing useful to say (an import line is noise).
  return "";
}

function walk(root, rel, acc) {
  const abs = path.join(root, rel);
  for (const name of fs.readdirSync(abs)) {
    const relPath = rel ? `${rel}/${name}` : name;
    const absPath = path.join(abs, name);
    let stat;
    try {
      stat = fs.statSync(absPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(root, relPath, acc);
      continue;
    }
    if (!EXTENSIONS.has(path.extname(name)) || skipFile(name)) continue;
    acc.push(relPath);
  }
  return acc;
}

function describeFile(root, rel) {
  const abs = path.join(root, rel);
  const text = fs.readFileSync(abs, "utf8");
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  const ext = path.extname(rel);
  return {
    p: rel,
    l: lines.length,
    b: Buffer.byteLength(text, "utf8"),
    h: headOf(lines, ext),
    s: symbolsOf(lines, ext),
  };
}

/** The index for the source under `root` (docs/experiment). */
function buildIndex(root, options = {}) {
  const roots = options.roots ?? ROOTS;
  const extras = options.extraFiles ?? EXTRA_FILES;
  const paths = new Set();
  for (const r of roots)
    if (fs.existsSync(path.join(root, r.dir)))
      for (const p of walk(root, r.dir, [])) paths.add(p);
  for (const p of extras) if (fs.existsSync(path.join(root, p))) paths.add(p);
  const files = [...paths].sort().map((p) => describeFile(root, p));
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    roots: roots.filter((r) => fs.existsSync(path.join(root, r.dir))),
    files,
  };
}

const OUTPUT = "studio-code-index.json";

function main() {
  const root = process.cwd();
  const index = buildIndex(root);
  const out = path.join(root, OUTPUT);
  fs.writeFileSync(out, JSON.stringify(index));
  const bytes = index.files.reduce((s, f) => s + f.b, 0);
  console.log(
    `Wrote ${OUTPUT}: ${index.files.length} files, ${(bytes / 1024).toFixed(
      0,
    )} KB of source indexed (${(fs.statSync(out).size / 1024).toFixed(
      0,
    )} KB index).`,
  );
}

if (require.main === module) main();

module.exports = {
  buildIndex,
  describeFile,
  headOf,
  symbolsOf,
  ROOTS,
  EXTRA_FILES,
  OUTPUT,
};
