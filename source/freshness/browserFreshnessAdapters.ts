import { get, onValue, ref } from "firebase/database";

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

type VisibilityDocument = Pick<
  Document,
  "visibilityState" | "addEventListener" | "removeEventListener"
>;

export const subscribeToVisibility = (
  documentBoundary: VisibilityDocument,
  listener: () => void,
): (() => void) => {
  let wasHidden = documentBoundary.visibilityState === "hidden";
  const handleVisibilityChange = () => {
    if (documentBoundary.visibilityState === "hidden") {
      wasHidden = true;
    } else if (wasHidden) {
      wasHidden = false;
      listener();
    }
  };

  documentBoundary.addEventListener("visibilitychange", handleVisibilityChange);
  return () =>
    documentBoundary.removeEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );
};

const subscribeToDeploymentNotifications = (
  listener: (notification: unknown) => void,
): (() => void) => {
  let disposed = false;
  let unsubscribe: (() => void) | undefined;

  void import("../components/firebase")
    .then(({ db }) => {
      if (disposed) return;
      unsubscribe = onValue(ref(db, notificationPath), (snapshot) => {
        listener(snapshot.val());
      });
    })
    .catch(() => {
      // Freshness notifications are advisory; manifest checks remain usable.
    });

  return () => {
    disposed = true;
    unsubscribe?.();
  };
};

export const createBrowserFreshnessController = (): FreshnessController => {
  const production = process.env.NODE_ENV === "production";
  return createFreshnessController({
    mode: production ? "production" : "development",
    runningDeploymentId: production ? process.env.DEPLOY_ID || null : null,
    loadDeploymentNotification,
    loadManifest,
    subscribeToDeploymentNotifications,
    subscribeToVisibility: (listener) =>
      subscribeToVisibility(document, listener),
    retry: browserRetry,
  });
};
