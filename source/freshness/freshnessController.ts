export type FreshnessState =
  | { status: "checking"; message: "Checking compiler freshness..." }
  | { status: "fresh"; message: string }
  | { status: "stale"; publishedAtUtc: string };

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
  retry?: FreshnessRetry;
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
  message: "Fresh. This compiler is running in development mode.",
};

const automaticRetryDelays = [1000, 2000, 4000];

const inactiveRetry: FreshnessRetry = {
  getAttempts: () => automaticRetryDelays.length,
  setAttempts: () => undefined,
  replaceWithDeployment: () => undefined,
  schedule: () => undefined,
  cancelScheduled: () => undefined,
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

const formatUtc = (publishedAt: string): string =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(publishedAt));

export const createFreshnessController = ({
  mode,
  runningDeploymentId,
  loadDeploymentNotification,
  loadManifest,
  retry = inactiveRetry,
}: FreshnessControllerOptions): FreshnessController => {
  let state: FreshnessState =
    mode === "development" ? developmentState : checkingState;
  let disposed = false;
  let staleTarget: string | null = null;
  let scheduledRetry: unknown;
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
    retry.setAttempts(staleTarget, attempts + 1);
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

  const check = async () => {
    if (mode === "development" || disposed) return;

    try {
      const [notification, manifest] = await Promise.all([
        loadDeploymentNotification(),
        loadManifest(),
      ]);

      if (
        isDeploymentNotification(notification) &&
        isDeploymentManifest(manifest) &&
        manifest.deploymentId === runningDeploymentId &&
        notification.deploymentId === manifest.deploymentId
      ) {
        staleTarget = null;
        cancelRetry();
        publish({
          status: "fresh",
          message: `Fresh. This page is up to date: ${formatUtc(
            notification.publishedAt,
          )}.`,
        });
      } else if (
        isDeploymentNotification(notification) &&
        isDeploymentManifest(manifest) &&
        notification.deploymentId === manifest.deploymentId &&
        manifest.deploymentId !== runningDeploymentId
      ) {
        const publishedAtUtc = formatUtc(notification.publishedAt);
        publish({
          status: "stale",
          publishedAtUtc,
        });
        scheduleReplacement(manifest.deploymentId);
      }
    } catch {
      // Freshness is informational. An unavailable service leaves the UI in
      // Checking without interfering with spreadsheet selection or compilation.
    }
  };

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    start: check,
    actions: { check, refresh: () => attemptDeploymentReplacement(true) },
    dispose: () => {
      disposed = true;
      cancelRetry();
      listeners.clear();
    },
  };
};
