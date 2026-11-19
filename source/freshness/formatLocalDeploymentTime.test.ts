import {
  formatLocalDeploymentTime,
  formatPageUpToDateTime,
} from "./formatLocalDeploymentTime";

describe("formatLocalDeploymentTime", () => {
  it("reports the scientist's local time and rounds it to the minute", () => {
    expect(
      formatLocalDeploymentTime("2026-08-02T11:25:43.000Z", "America/New_York"),
    ).toBe("Aug 2, 2026, 7:25 AM UTC-4");
  });

  it("uses the offset in effect at the deployment time", () => {
    expect(
      formatLocalDeploymentTime("2026-01-02T11:25:43.000Z", "America/New_York"),
    ).toBe("Jan 2, 2026, 6:25 AM UTC-5");
  });
});

describe("formatPageUpToDateTime", () => {
  it("formats the date, time, and offset for the page freshness line", () => {
    expect(
      formatPageUpToDateTime("2026-11-18T06:27:43.000Z", "America/New_York"),
    ).toBe("Nov 18, 2026 at 1:27 AM (UTC-5)");
  });
});
