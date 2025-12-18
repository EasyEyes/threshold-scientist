/**
 * Sentry Error Tracking Initialization
 *
 * Initializes Sentry for error tracking.
 * This should be imported at the very top of the application entry point.
 *
 * Environment Variables:
 * - SENTRY_DSN: Sentry project DSN (required)
 * - SENTRY_ENVIRONMENT: Environment name (development/production)
 */

import * as Sentry from "@sentry/react";

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  const environment = process.env.SENTRY_ENVIRONMENT || "development";

  if (!dsn) {
    console.warn("⚠️  SENTRY_DSN not set. Error tracking disabled.");
    return;
  }

  Sentry.init({
    dsn,
    environment,
    // Ignore common errors that aren't useful to track
    ignoreErrors: [
      // Browser extensions
      "chrome-extension://",
      "moz-extension://",
      // User script errors
      "top.GLOBALS",
      // Random plugins/extensions
      "SecurityError: Blocked a frame with origin",
    ],
    sendDefaultPii: true,
    enableLogs: true,
  });

  console.log(`✓ Sentry initialized for threshold-scientist (${environment})`);
}

// Export Sentry for manual error capturing
export { Sentry };
