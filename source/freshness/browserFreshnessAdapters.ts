import { get, ref } from "firebase/database";

import {
  createFreshnessController,
  FreshnessController,
  FreshnessRetry,
} from "./freshnessController";

const notificationPath = "deployments/compiler/production";

const loadDeploymentNotification = async (): Promise<unknown> => {
  const { db } = await import("../components/firebase");
  const snapshot = await get(ref(db, notificationPath));
  return snapshot.val();
};

const loadManifest = async (): Promise<unknown> => {
  const response = await fetch("/compiler/deployment.json", {
    cache: "no-cache",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Deployment manifest request failed (${response.status})`);
  }
  return response.json();
};

const retryStoragePrefix = "easyeyes:compiler-freshness:attempts:";
const deploymentQueryParameter = "compilerDeploymentId";

type BrowserLocation = Pick<Location, "href" | "replace">;

export const createBrowserRetry = (
  location: BrowserLocation,
  storage: Pick<Storage, "getItem" | "setItem">,
): FreshnessRetry => ({
  getAttempts: (targetDeploymentId) => {
    const stored = storage.getItem(
      `${retryStoragePrefix}${targetDeploymentId}`,
    );
    const attempts = stored === null ? 0 : Number.parseInt(stored, 10);
    return Number.isInteger(attempts) && attempts >= 0 ? attempts : 0;
  },
  setAttempts: (targetDeploymentId, attempts) => {
    storage.setItem(
      `${retryStoragePrefix}${targetDeploymentId}`,
      String(attempts),
    );
  },
  replaceWithDeployment: (targetDeploymentId) => {
    const target = new URL(location.href);
    target.searchParams.set(deploymentQueryParameter, targetDeploymentId);
    location.replace(target.toString());
  },
  schedule: (callback, delayMs) => window.setTimeout(callback, delayMs),
  cancelScheduled: (scheduled) => window.clearTimeout(scheduled as number),
});

export const browserRetry = createBrowserRetry(
  window.location,
  window.sessionStorage,
);

export const createBrowserFreshnessController = (): FreshnessController => {
  const production = process.env.NODE_ENV === "production";
  return createFreshnessController({
    mode: production ? "production" : "development",
    runningDeploymentId: production ? process.env.DEPLOY_ID || null : null,
    loadDeploymentNotification,
    loadManifest,
    retry: browserRetry,
  });
};
