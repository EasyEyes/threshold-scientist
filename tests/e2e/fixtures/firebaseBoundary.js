// Running imports the database handle, but the E2E harness disables compile
// count loading. Keeping Firebase outside this bundle also prevents public
// network access during deterministic browser tests.
export const db = {};
