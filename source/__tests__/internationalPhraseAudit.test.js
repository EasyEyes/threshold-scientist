import {
  collectInternationalPhraseReferences,
  validateInternationalPhraseAudit,
} from "../../threshold/preprocess/internationalPhraseAudit";
const refs = collectInternationalPhraseReferences([
  ["text", "", "EE_yes, RC_no T_old ⓁEE_custom ⓃT_custom ~EE_legacy"],
]);
it("excludes custom symbols", () => {
  expect(refs.map((r) => r.key)).toEqual(["EE_yes", "RC_no", "T_old"]);
});
it("blocks unaudited keys with evidence", () => {
  const errors = validateInternationalPhraseAudit(refs, {
    id: "audit",
    generatedAt: "2026-10-12",
    usedKeys: ["EE_yes"],
    findings: {
      removed: [
        {
          key: "T_old",
          removals: [{ repository: "threshold", removedAt: "2025-01-01" }],
        },
      ],
    },
  });
  expect(errors).toHaveLength(2);
  expect(errors[1].hint).toContain("2025-01-01");
  expect(errors.every((e) => e.kind === "error")).toBe(true);
});
it("rejects malformed reports", () => {
  expect(() => validateInternationalPhraseAudit(refs, {})).toThrow();
});

jest.mock("../../threshold/components/easyeyesBaseUrl", () => ({
  getEasyEyesBaseUrl: async () => "",
}));
import { checkInternationalPhraseAudit } from "../../threshold/preprocess/internationalPhraseAudit";
it("does not request an audit for custom-only studies", async () => {
  global.fetch = jest.fn();
  expect(
    await checkInternationalPhraseAudit([["text", "", "ⓁEE_custom"]]),
  ).toEqual([]);
  expect(global.fetch).not.toHaveBeenCalled();
});
it("blocks compilation when the audit service fails", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false });
  const errors = await checkInternationalPhraseAudit([
    ["text", "", "EE_missing"],
  ]);
  expect(errors[0].name).toBe("International Phrases audit unavailable");
  expect(errors[0].kind).toBe("error");
});

it("links an unaudited key to its exact sheet cell when its row is known", () => {
  const errors = validateInternationalPhraseAudit(
    [{ key: "EE_old", parameter: "instruction", column: 2 }],
    { id: "audit", generatedAt: "2026-10-12", usedKeys: [] },
    new Map([["EE_old", 42]]),
  );
  expect(errors[0].message).toContain("&range=A42");
  expect(errors[0].message).toContain('target="_blank"');
  expect(errors[0].message).toContain('rel="noopener noreferrer"');
});
it("falls back to the sheet when the phrase row is unavailable", () => {
  const errors = validateInternationalPhraseAudit(
    [{ key: "EE_old", parameter: "instruction", column: 2 }],
    { id: "audit", generatedAt: "2026-10-12", usedKeys: [] },
  );
  expect(errors[0].message).toContain("/edit#gid=0");
  expect(errors[0].message).not.toContain("&range=");
});
