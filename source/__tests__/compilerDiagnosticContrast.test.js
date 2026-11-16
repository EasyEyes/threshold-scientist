import fs from "fs";
import path from "path";

const scss = fs.readFileSync(
  path.join(__dirname, "../css/CompilerDiagnostic.scss"),
  "utf8",
);
const scssVariables = {
  error: "#bb2c22",
  green: "#019267",
  "dark-green": "#157558",
};

const resolveColor = (value) => {
  const variable = value.match(/^#\{\$([^}]+)\}$/);
  return variable ? scssVariables[variable[1]] : value;
};
const tokens = (kind) => {
  const block = scss.match(
    new RegExp(`\\.compiler-diagnostic-${kind}\\s*\\{([\\s\\S]*?)\\n\\}`),
  );
  if (!block) throw new Error(`Missing diagnostic style: ${kind}`);
  const token = (name) => {
    const match = block[1].match(new RegExp(`${name}:\\s*([^;]+);`));
    if (!match) throw new Error(`Missing ${name} for ${kind}`);
    return resolveColor(match[1].trim());
  };
  return {
    accent: token("--diagnostic-accent"),
    background: token("--diagnostic-background"),
    border: token("--diagnostic-border"),
  };
};
const luminance = (hex) => {
  const channels = [1, 3, 5]
    .map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};
const contrast = (foreground, background) => {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
};

const expected = {
  correct: {
    accent: "#157558",
    background: "#f6fff2",
    border: "#019267",
  },
  error: {
    accent: "#bb2c22",
    background: "#fff3f3",
    border: "#bb2c22",
  },
  warning: {
    accent: "#b45309",
    background: "#fffaf0",
    border: "#ea580c",
  },
};

describe.each(Object.entries(expected))(
  "%s diagnostic accessibility",
  (kind, want) => {
    const actual = tokens(kind);

    it("uses the approved severity palette", () => {
      expect(actual).toEqual(want);
    });

    it("meets AA text contrast for headings and body text", () => {
      expect(contrast(actual.accent, actual.background)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(contrast("#333333", actual.background)).toBeGreaterThanOrEqual(
        4.5,
      );
    });

    it("meets non-text contrast for the border against card and page", () => {
      expect(contrast(actual.border, actual.background)).toBeGreaterThanOrEqual(
        3,
      );
      expect(contrast(actual.border, "#ffffff")).toBeGreaterThanOrEqual(3);
    });
  },
);
