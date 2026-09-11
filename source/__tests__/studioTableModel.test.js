// The Studio's column "%": disabling a column through the compiler's own
// switch, conditionEnabledBool (tableModel.ts).
import {
  columnDisabledBy,
  matrixToState,
  skippedCells,
  stateToMatrix,
  toggleConditionEnabled,
} from "../studio/tableModel";

const table = () =>
  matrixToState([
    ["_about", "demo"],
    ["block", "", "1", "1", "2"],
    ["conditionName", "", "a", "b", "c"],
    ["thresholdBeta", "", "2.3", "2.3", "2.3"],
  ]);

describe("toggleConditionEnabled", () => {
  it("adds conditionEnabledBool alphabetically with FALSE in that column only", () => {
    const t = toggleConditionEnabled(table(), 1);
    expect(stateToMatrix(t)).toEqual([
      ["_about", "demo", "", "", ""],
      ["block", "", "1", "1", "2"],
      ["conditionEnabledBool", "", "", "FALSE", ""],
      ["conditionName", "", "a", "b", "c"],
      ["thresholdBeta", "", "2.3", "2.3", "2.3"],
    ]);
    expect(columnDisabledBy(t, 0)).toBeNull();
    expect(columnDisabledBy(t, 1)).toBe("conditionEnabledBool");
    expect(columnDisabledBy(t, 2)).toBeNull();
  });

  it("toggling back removes the row it added, leaving the table as it was", () => {
    const before = stateToMatrix(table());
    const t = toggleConditionEnabled(toggleConditionEnabled(table(), 1), 1);
    expect(stateToMatrix(t)).toEqual(before);
    expect(columnDisabledBy(t, 1)).toBeNull();
  });

  it("keeps an existing conditionEnabledBool row and only blanks its own cell", () => {
    const t0 = matrixToState([
      ["block", "", "1", "1"],
      ["conditionEnabledBool", "", "TRUE", "false"],
      ["conditionName", "", "a", "b"],
    ]);
    expect(columnDisabledBy(t0, 1)).toBe("conditionEnabledBool");
    const t1 = toggleConditionEnabled(t0, 1);
    expect(stateToMatrix(t1)[1]).toEqual([
      "conditionEnabledBool",
      "",
      "TRUE",
      "",
    ]);
    const t2 = toggleConditionEnabled(t1, 0);
    expect(stateToMatrix(t2)[1]).toEqual([
      "conditionEnabledBool",
      "",
      "FALSE",
      "",
    ]);
  });

  it("ignores a %-commented conditionEnabledBool row", () => {
    const t0 = matrixToState([
      ["block", "", "1"],
      ["%conditionEnabledBool", "", "FALSE"],
      ["conditionName", "", "a"],
    ]);
    expect(columnDisabledBy(t0, 0)).toBeNull();
    const t1 = toggleConditionEnabled(t0, 0);
    // Inserted alphabetically; the commented row compares by its bare name,
    // so the new row lands right after it.
    expect(stateToMatrix(t1).map((r) => r[0])).toEqual([
      "block",
      "%conditionEnabledBool",
      "conditionEnabledBool",
      "conditionName",
    ]);
    expect(columnDisabledBy(t1, 0)).toBe("conditionEnabledBool");
  });

  it("reports a column dropped by conditionTrials 0", () => {
    const t = matrixToState([
      ["block", "", "1", "1"],
      ["conditionName", "", "a", "b"],
      ["conditionTrials", "", "0", "20"],
    ]);
    expect(columnDisabledBy(t, 0)).toBe("conditionTrials");
    expect(columnDisabledBy(t, 1)).toBeNull();
  });
});

describe("skippedCells", () => {
  it("lists commented rows and disabled columns as matrix positions", () => {
    const t = matrixToState([
      ["block", "", "1", "1", "2"],
      ["%conditionName", "", "old", "old", "old"],
      ["conditionEnabledBool", "", "", "FALSE", ""],
      ["conditionName", "", "a", "b", "c"],
      ["conditionTrials", "", "20", "20", "0"],
    ]);
    // Row 1 is commented; column D (index 3) is disabled by the toggle and
    // column E (index 4) by conditionTrials 0.
    expect(skippedCells(t)).toEqual({ rows: [1], columns: [3, 4] });
  });

  it("is empty for a table with nothing skipped", () => {
    expect(
      skippedCells(
        matrixToState([
          ["block", "", "1"],
          ["conditionName", "", "a"],
        ]),
      ),
    ).toEqual({ rows: [], columns: [] });
  });
});
