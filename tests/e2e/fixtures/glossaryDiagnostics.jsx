import React from "react";
import Table from "../../../source/Table";
import { initGlossary } from "../../../threshold/parameters/glossaryRegistry";
import { loadGlossaryRows } from "../../../threshold/parameters/glossaryLink";
import { ExperimentTable } from "../../../threshold/preprocess/experimentTable";
import { validateExperimentTable } from "../../../threshold/preprocess/validateExperimentTable";
import { validateInternationalPhraseAudit } from "../../../threshold/preprocess/internationalPhraseAudit";
import { validateGlossaryAudit } from "../../../threshold/preprocess/glossaryAudit";

// Offline catalog and completed-audit boundaries; validators and Table are real.
const glossary = Object.fromEntries(
  [
    ["_online2PayCurrency", "obsolete", "Use _online2PayCurrencyCode instead."],
    ["_online2PayCurrencyCode", "text", ""],
    ["fontLeftToRightBool", "obsolete", "Use fontDirection instead."],
    ["fontDirection", "text", ""],
    ["font", "text", ""],
  ].map(([name, type, explanation]) => [
    name,
    { name, type, explanation, default: "", categories: [] },
  ]),
);

class DiagnosticTable extends Table {
  constructor(props) {
    super(props);
    initGlossary({
      version: "test",
      glossary,
      glossaryFull: [],
      superMatchingParams: [],
    });
    const rows = [
      ["_online2PayCurrency", "USD"],
      ["fontLeftToRightBool", "", "TRUE"],
      ["fontDirectionz", "", "ltr"],
    ];
    this.state = {
      ...this.state,
      tableName: "glossary-diagnostics.csv",
      errors: [
        ...validateExperimentTable(new ExperimentTable(rows)).filter((e) =>
          ["Parameter is obsolete", "Parameter is unrecognized"].includes(
            e.name,
          ),
        ),
        ...validateInternationalPhraseAudit(
          [{ key: "EE_auditMissing", parameter: "font", column: 2 }],
          { id: "test-phrase-audit", generatedAt: "2026-11-17", usedKeys: [] },
        ),
        ...validateGlossaryAudit([{ parameter: "font", key: "font" }], {
          id: "internal-audit-id",
          generatedAt: "2026-11-12",
          glossaryVersion: "test",
          usedKeys: [],
          unusedKeys: ["font"],
          findings: [
            {
              key: "font",
              removals: [{ repository: "threshold", removedAt: "2026-07-02" }],
            },
          ],
        }),
      ],
    };
  }
  componentDidMount() {
    loadGlossaryRows(async () => ({
      ok: true,
      text: async () =>
        [
          "INPUT PARAMETER,TYPE",
          ...Object.values(glossary).map((g) => `${g.name},${g.type}`),
        ].join("\n"),
    })).then(() => this.forceUpdate());
  }
}

export default function GlossaryDiagnostics() {
  return (
    <section className="step-table">
      <DiagnosticTable
        resources={{}}
        resourcesLoaded
        user={{ projectList: [] }}
        functions={{}}
        activeExperiment="new"
      />
    </section>
  );
}
