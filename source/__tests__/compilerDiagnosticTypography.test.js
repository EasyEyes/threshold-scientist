import fs from "fs";
import path from "path";

const css = fs.readFileSync(
  path.join(__dirname, "../css/CompilerDiagnostic.scss"),
  "utf8",
);

describe("compiler diagnostic typography and interaction styles", () => {
  it("uses readable, left-aligned body text with a bounded measure", () => {
    expect(css).toMatch(/text-align:\s*left/);
    expect(css).toMatch(/line-height:\s*1\.5/);
    expect(css).toMatch(/max-width:\s*80ch/);
  });

  it("uses an 18px title with 1.4 line height", () => {
    const heading = css.match(/\.error-heading\s*\{[^}]+/);
    expect(heading).not.toBeNull();
    expect(heading[0]).toMatch(/font-size:\s*1\.125rem/);
    expect(heading[0]).toMatch(/line-height:\s*1\.4/);
  });

  it("uses consistent spacing between diagnostic sections", () => {
    expect(css).toMatch(/\.diagnostic-section\s*\{[^}]*margin-top:\s*0\.6rem/);
  });

  it("provides visible keyboard focus and minimum target sizes", () => {
    expect(css).toContain(":focus-visible");
    expect(css).toMatch(/min-width:\s*24px/);
    expect(css).toMatch(/min-height:\s*24px/);
  });

  it("distinguishes values from prose and parameter names", () => {
    const value = css.match(/\.error-value\s*\{[^}]+/);
    expect(value).not.toBeNull();
    expect(value[0]).toMatch(/font-family:[^;]*monospace/);
    expect(value[0]).toMatch(/background:/);
    expect(value[0]).toMatch(/white-space:\s*pre-wrap/);
    expect(value[0]).toMatch(/overflow-wrap:\s*anywhere/);
  });
});
