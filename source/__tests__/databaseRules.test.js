/** @jest-environment node */

const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");
const { readFileSync } = require("fs");
const { get, ref, set } = require("firebase/database");

const projectId = "demo-easyeyes-compiler";
const notificationPath = "deployments/compiler/production";
let testEnvironment;

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    database: {
      rules: readFileSync("database.rules.json", "utf8"),
    },
  });
});

beforeEach(async () => {
  await testEnvironment.clearDatabase();
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

async function seedNotification() {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await set(ref(context.database(), notificationPath), {
      deploymentId: "deploy-123",
      publishedAt: "2026-07-14T10:00:00.000Z",
    });
  });
}

describe("compiler deployment notification database rules", () => {
  it("allows an unauthenticated browser to read the production notification", async () => {
    await seedNotification();
    const database = testEnvironment.unauthenticatedContext().database();

    const snapshot = await assertSucceeds(get(ref(database, notificationPath)));

    expect(snapshot.val()).toEqual({
      deploymentId: "deploy-123",
      publishedAt: "2026-07-14T10:00:00.000Z",
    });
  });

  it("denies unauthenticated writes to the production notification", async () => {
    const database = testEnvironment.unauthenticatedContext().database();

    await assertFails(
      set(ref(database, notificationPath), {
        deploymentId: "deploy-456",
        publishedAt: "2026-07-14T11:00:00.000Z",
      }),
    );
  });

  it.each(["deployments", "deployments/compiler"])(
    "denies reads above the selected notification node at /%s",
    async (path) => {
      await seedNotification();
      const database = testEnvironment.unauthenticatedContext().database();

      await assertFails(get(ref(database, path)));
    },
  );

  it("keeps unrelated paths denied by default", async () => {
    const database = testEnvironment.unauthenticatedContext().database();

    await assertFails(get(ref(database, "unrelated")));
    await assertFails(set(ref(database, "unrelated"), "value"));
  });

  it("preserves existing public read access", async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await set(ref(context.database(), "currentVersion"), "2.0.0");
    });
    const database = testEnvironment.unauthenticatedContext().database();

    const snapshot = await assertSucceeds(get(ref(database, "currentVersion")));

    expect(snapshot.val()).toBe("2.0.0");
  });

  it("preserves existing valid compile writes", async () => {
    const database = testEnvironment.unauthenticatedContext().database();

    await assertSucceeds(
      set(ref(database, "compiles/compile-123"), {
        id: "compile-123",
        user: "scientist@example.com",
        timestamp: 1784023200000,
        timeZone: "Asia/Yerevan",
      }),
    );
  });
});
