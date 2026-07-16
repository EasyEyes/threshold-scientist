import { get, onValue, ref } from "firebase/database";
import { Sentry } from "../sentry";

import {
  createFreshnessController,
  FreshnessController,
  FreshnessDiagnostics,
  FreshnessReporting,
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

const reportStoragePrefix = "easyeyes:compiler-freshness:reported:";

type SentryBoundary = Pick<typeof Sentry, "addBreadcrumb" | "captureException">;
type BrowserNavigator = Pick<Navigator, "userAgent">;

export const createBrowserFreshnessReporting = (
  sentry: SentryBoundary,
  location: Pick<Location, "href">,
  navigator: BrowserNavigator,
  storage: Pick<Storage, "getItem" | "setItem">,
): FreshnessReporting => {
  const allowlistedAttemptData = (diagnostics: FreshnessDiagnostics) => ({
    runningDeploymentId: diagnostics.runningDeploymentId,
    liveDeploymentId: diagnostics.liveDeploymentId,
    retryCount: diagnostics.retryCount,
  });

  return {
    hasReported: (targetDeploymentId) =>
      storage.getItem(`${reportStoragePrefix}${targetDeploymentId}`) === "1",
    markReported: (targetDeploymentId) =>
      storage.setItem(`${reportStoragePrefix}${targetDeploymentId}`, "1"),
    addFailedAttemptBreadcrumb: (diagnostics) => {
      sentry.addBreadcrumb({
        category: "compiler-freshness",
        level: "warning",
        message: `Compiler remained stale after refresh attempt ${diagnostics.retryCount}`,
        data: allowlistedAttemptData(diagnostics),
      });
    },
    reportExhaustedRefreshes: (diagnostics) => {
      const currentUrl = new URL(location.href);
      sentry.captureException(
        new Error("Compiler remained stale after refresh attempts"),
        {
          fingerprint: ["compiler-stale-after-refresh"],
          tags: { context: "compiler-stale-after-refresh" },
          extra: {
            runningDeploymentId: diagnostics.runningDeploymentId,
            liveDeploymentId: diagnostics.liveDeploymentId,
            publishedAt: diagnostics.publishedAt,
            retryCount: diagnostics.retryCount,
            url: `${currentUrl.origin}${currentUrl.pathname}`,
            browser: navigator.userAgent,
          },
        },
      );
    },
  };
};

export const browserFreshnessReporting = createBrowserFreshnessReporting(
  Sentry,
  window.location,
  window.navigator,
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
    reporting: browserFreshnessReporting,
  });
};
