import { formatLocalDeploymentTime } from "./formatLocalDeploymentTime";

export type FreshnessState =
  | { status: "checking"; message: "Checking compiler freshness..." }
  | { status: "fresh"; message: string }
  | { status: "stale"; publishedAtUtc: string }
  | {
      status: "error";
      runningDeploymentId: string;
      liveDeploymentId: string;
      publishedAtUtc: string;
      retryCount: number;
    };

type DeploymentNotification = {
  deploymentId: string;
  publishedAt: string;
};

type DeploymentManifest = {
  deploymentId: string;
};

type FreshnessControllerOptions = {
  mode: "development" | "production";
  runningDeploymentId: string | null;
  loadDeploymentNotification: () => Promise<unknown>;
  loadManifest: () => Promise<unknown>;
  subscribeToDeploymentNotifications?: (
    listener: (notification: unknown) => void,
  ) => () => void;
  subscribeToVisibility?: (listener: () => void) => () => void;
  retry?: FreshnessRetry;
  reporting?: FreshnessReporting;
};

export type FreshnessDiagnostics = {
  runningDeploymentId: string;
  liveDeploymentId: string;
  publishedAt: string;
  retryCount: number;
};

export type FreshnessReporting = {
  hasReported: (targetDeploymentId: string) => boolean;
  markReported: (targetDeploymentId: string) => void;
  addFailedAttemptBreadcrumb: (diagnostics: FreshnessDiagnostics) => void;
  reportExhaustedRefreshes: (diagnostics: FreshnessDiagnostics) => void;
};

export type FreshnessRetry = {
  getAttempts: (targetDeploymentId: string) => number;
  setAttempts: (targetDeploymentId: string, attempts: number) => void;
  replaceWithDeployment: (targetDeploymentId: string) => void;
  schedule: (callback: () => void, delayMs: number) => unknown;
  cancelScheduled: (scheduled: unknown) => void;
};

export type FreshnessController = {
  getState: () => FreshnessState;
  subscribe: (listener: (state: FreshnessState) => void) => () => void;
  start: () => Promise<void>;
  actions: { check: () => Promise<void>; refresh: () => void };
  dispose: () => void;
};

const checkingState: FreshnessState = {
  status: "checking",
  message: "Checking compiler freshness...",
};

const developmentState: FreshnessState = {
  status: "fresh",
  message: "Fresh. The compiler is running in development mode.",
};

const automaticRetryDelays = [1000, 2000, 4000];

const inactiveRetry: FreshnessRetry = {
  getAttempts: () => 0,
  setAttempts: () => undefined,
  replaceWithDeployment: () => undefined,
  schedule: () => undefined,
  cancelScheduled: () => undefined,
};

const inactiveReporting: FreshnessReporting = {
  hasReported: () => true,
  markReported: () => undefined,
  addFailedAttemptBreadcrumb: () => undefined,
  reportExhaustedRefreshes: () => undefined,
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isDeploymentNotification = (
  value: unknown,
): value is DeploymentNotification => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<DeploymentNotification>;
  return (
    isNonEmptyString(candidate.deploymentId) &&
    isNonEmptyString(candidate.publishedAt) &&
    !Number.isNaN(Date.parse(candidate.publishedAt))
  );
};

const isDeploymentManifest = (value: unknown): value is DeploymentManifest => {
  if (typeof value !== "object" || value === null) return false;
  return isNonEmptyString((value as Partial<DeploymentManifest>).deploymentId);
};

export const createFreshnessController = ({
  mode,
  runningDeploymentId,
  loadDeploymentNotification,
  loadManifest,
  subscribeToDeploymentNotifications,
  subscribeToVisibility,
  retry = inactiveRetry,
  reporting = inactiveReporting,
}: FreshnessControllerOptions): FreshnessController => {
  let state: FreshnessState =
    mode === "development" ? developmentState : checkingState;
  let disposed = false;
  let staleTarget: string | null = null;
  let scheduledRetry: unknown;
  let unsubscribeNotifications: (() => void) | undefined;
  let unsubscribeVisibility: (() => void) | undefined;
  let started = false;
  let latestCheck = 0;
  const listeners = new Set<(nextState: FreshnessState) => void>();

  const publish = (nextState: FreshnessState) => {
    if (disposed) return;
    state = nextState;
    listeners.forEach((listener) => listener(state));
  };

  const cancelRetry = () => {
    if (scheduledRetry === undefined) return;
    retry.cancelScheduled(scheduledRetry);
    scheduledRetry = undefined;
  };

  const attemptDeploymentReplacement = (manual = false) => {
    if (disposed || staleTarget === null) return;
    const attempts = retry.getAttempts(staleTarget);
    if (!manual && attempts >= automaticRetryDelays.length) return;
    cancelRetry();
    const retryCount = attempts + 1;
    retry.setAttempts(staleTarget, retryCount);
    if (runningDeploymentId !== null) {
      reporting.addFailedAttemptBreadcrumb({
        runningDeploymentId,
        liveDeploymentId: staleTarget,
        publishedAt: "unknown",
        retryCount,
      });
    }
    retry.replaceWithDeployment(staleTarget);
  };

  const scheduleReplacement = (targetDeploymentId: string) => {
    cancelRetry();
    staleTarget = targetDeploymentId;
    const attempts = retry.getAttempts(targetDeploymentId);
    const delay = automaticRetryDelays[attempts];
    if (delay === undefined) return;
    scheduledRetry = retry.schedule(attemptDeploymentReplacement, delay);
  };

  const publishExhausted = (
    targetDeploymentId: string,
    publishedAt: string,
    retryCount: number,
  ) => {
    if (runningDeploymentId === null) return;
    const diagnostics: FreshnessDiagnostics = {
      runningDeploymentId,
      liveDeploymentId: targetDeploymentId,
      publishedAt,
      retryCount,
    };
    publish({
      status: "error",
      runningDeploymentId,
      liveDeploymentId: targetDeploymentId,
      publishedAtUtc: formatLocalDeploymentTime(publishedAt),
      retryCount,
    });
    if (reporting.hasReported(targetDeploymentId)) return;
    for (let attempt = 1; attempt <= retryCount; attempt += 1) {
      reporting.addFailedAttemptBreadcrumb({
        ...diagnostics,
        retryCount: attempt,
      });
    }
    reporting.reportExhaustedRefreshes(diagnostics);
    reporting.markReported(targetDeploymentId);
  };

  const verify = async (notificationRequest: Promise<unknown>) => {
    if (mode === "development" || disposed) return;
    const checkId = ++latestCheck;

    try {
      const [notification, manifest] = await Promise.all([
        notificationRequest.catch(() => undefined),
        loadManifest(),
      ]);

      if (disposed || checkId !== latestCheck) return;

      if (!isDeploymentManifest(manifest)) return;

      const notificationMatchesManifest =
        isDeploymentNotification(notification) &&
        notification.deploymentId === manifest.deploymentId;

      if (manifest.deploymentId === runningDeploymentId) {
        staleTarget = null;
        cancelRetry();
        if (notificationMatchesManifest) {
          publish({
            status: "fresh",
            message: `Fresh. This page is up to date: ${formatLocalDeploymentTime(
              notification.publishedAt,
            )}.`,
          });
        } else {
          publish({
            status: "fresh",
            message: "Fresh. This page is up to date.",
          });
        }
      } else {
        if (notificationMatchesManifest) {
          const attempts = retry.getAttempts(manifest.deploymentId);
          if (attempts >= automaticRetryDelays.length) {
            publishExhausted(
              manifest.deploymentId,
              notification.publishedAt,
              attempts,
            );
          } else {
            publish({
              status: "stale",
              publishedAtUtc: formatLocalDeploymentTime(
                notification.publishedAt,
              ),
            });
          }
        }
        scheduleReplacement(manifest.deploymentId);
      }
    } catch {
      // Freshness is informational. An unavailable service leaves the UI in
      // Checking without interfering with spreadsheet selection or compilation.
    }
  };

  const check = () => {
    if (mode === "development" || disposed) return Promise.resolve();
    return verify(loadDeploymentNotification());
  };

  const start = () => {
    if (mode === "development" || disposed) return Promise.resolve();
    if (!started) {
      started = true;
      unsubscribeNotifications = subscribeToDeploymentNotifications?.(
        (notification) => {
          void verify(Promise.resolve(notification));
        },
      );
      unsubscribeVisibility = subscribeToVisibility?.(() => {
        void check();
      });
    }
    return check();
  };

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    start,
    actions: { check, refresh: () => attemptDeploymentReplacement(true) },
    dispose: () => {
      disposed = true;
      cancelRetry();
      unsubscribeNotifications?.();
      unsubscribeVisibility?.();
      listeners.clear();
    },
  };
};
