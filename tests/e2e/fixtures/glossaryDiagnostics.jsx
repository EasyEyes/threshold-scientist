import React from "react";
import Table from "../../../source/Table";
import { initGlossary } from "../../../threshold/parameters/glossaryRegistry";
import { loadGlossaryRows } from "../../../threshold/parameters/glossaryLink";
import { ExperimentTable } from "../../../threshold/preprocess/experimentTable";
import { validateExperimentTable } from "../../../threshold/preprocess/validateExperimentTable";
import { validateGlossaryAudit } from "../../../threshold/preprocess/glossaryAudit";

// Offline catalog and completed-audit boundaries; validators and Table are real.
const glossary = Object.fromEntries(
  [
    ["_online2PayCurrency", "obsolete", "Use _online2PayCurrencyCode instead."],
    ["_online2PayCurrencyCode", "text", ""],
    ["fontLeftToRightBool", "obsolete", "Use fontDirection instead."],
    ["fontDirection", "text", ""],
    ["font", "text", ""],
    ["_needBrowser", "multicategorical", ""],
  ].map(([name, type, explanation]) => [
    name,
    { name, type, explanation, default: "", categories: [] },
  ]),
);

class DiagnosticTable extends Table {
  constructor(props) {
    super(props);
    glossary._needBrowser.categories = [
      "all",
      "Chrome",
      "Chrome Mobile",
      "Safari",
      "Firefox",
      "Edge",
    ];
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
      ["_needBrowser", "Cgrome, Firefox, Edge"],
    ];
    this.state = {
      ...this.state,
      tableName: "glossary-diagnostics.csv",
      alerts: [
        ...validateExperimentTable(new ExperimentTable(rows)).filter((e) =>
          [
            "Parameter is obsolete",
            "Parameter is unrecognized",
            "Parameter contains values of the wrong type",
          ].includes(e.name),
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
