import { formatLocalDeploymentTime } from "./formatLocalDeploymentTime";

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
