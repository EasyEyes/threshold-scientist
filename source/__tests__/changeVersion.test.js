/**
 * The swap-vs-recompile decision (issue #179): a version change may only take
 * the cheap runtime-only-swap path when the target release speaks the exact
 * same engine.compile() contract (ADR 0001) as the experiment's current pin —
 * anything else forces a full re-compile, since a differing contract can mean
 * differing compiled-data shape and no pin-only change may alter frozen
 * condition files.
 */
import { decideVersionChangeMode } from "../engine/changeVersion";

describe("decideVersionChangeMode", () => {
  it("chooses a runtime-only swap when the target release shares the current pin's contractVersion", () => {
    expect(decideVersionChangeMode(1, 1)).toBe("swap");
  });

  it("forces a full re-compile when the target release speaks a different contractVersion", () => {
    expect(decideVersionChangeMode(1, 2)).toBe("recompile");
  });

  it("forces a full re-compile when the current pin has no known contractVersion (legacy pin)", () => {
    expect(decideVersionChangeMode(null, 1)).toBe("recompile");
  });
});
