import { get, ref } from "firebase/database";

import {
  createFreshnessController,
  FreshnessController,
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

export const createBrowserFreshnessController = (): FreshnessController => {
  const production = process.env.NODE_ENV === "production";
  return createFreshnessController({
    mode: production ? "production" : "development",
    runningDeploymentId: production ? process.env.DEPLOY_ID || null : null,
    loadDeploymentNotification,
    loadManifest,
  });
};
