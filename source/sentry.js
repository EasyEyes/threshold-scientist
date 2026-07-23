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

const SENSITIVE_KEY =
  /token|authorization|password|secret|spreadsheet|workbook|content|participant/i;
let currentCompilerOperation = null;

const sanitize = (value, depth = 0) => {
  if (depth > 4) return "[Truncated]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string")
    return value
      .replace(
        /(access_token|oauthToken|authorization)=([^&\s]+)/gi,
        "$1=[Filtered]",
      )
      .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [Filtered]");
  if (["number", "boolean"].includes(typeof value)) return value;
  if (Array.isArray(value))
    return value.slice(0, 50).map((item) => sanitize(item, depth + 1));
  if (typeof value !== "object") return String(value);

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[Filtered]" : sanitize(item, depth + 1),
    ]),
  );
};

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
    sendDefaultPii: false,
    enableLogs: true,
    beforeSend(event) {
      if (event.extra) event.extra = sanitize(event.extra);
      if (event.contexts) event.contexts = sanitize(event.contexts);
      if (event.tags) event.tags = sanitize(event.tags);
      if (event.breadcrumbs) event.breadcrumbs = sanitize(event.breadcrumbs);
      if (event.request) {
        event.request = sanitize(event.request);
        delete event.request.data;
        delete event.request.cookies;
        delete event.request.headers;
      }
      return event;
    },
  });

  console.log(`✓ Sentry initialized for threshold-scientist (${environment})`);
}

// Export Sentry for manual error capturing
export { Sentry };

/**
 * Capture and log an error to Sentry
 * Use this in catch blocks instead of just console.error()
 *
 * @param {Error} error - The error object to capture
 * @param {string} context - Descriptive context (e.g., "Login failed")
 * @param {Object} extra - Additional data to send with error
 *
 * @example
 * try {
 *   await loginUser(email, password);
 * } catch (error) {
 *   captureError(error, "User login", { email });
 * }
 */
export function captureError(error, context = "", extra = {}) {
  console.error(context, error);
  Sentry.captureException(error, {
    tags: { context },
    extra: sanitize(extra),
  });
}

/**
 * Capture a message to Sentry (for non-error events)
 *
 * @param {string} message - The message to log
 * @param {string} level - Log level: "info", "warning", "error"
 * @param {Object} extra - Additional context data
 *
 * @example
 * if (experimentDidNotComplete) {
 *   captureMessage("Experiment terminated early", "warning", { reason });
 * }
 */
export function captureMessage(message, level = "info", extra = {}) {
  console.log(`[Sentry] ${message}`);
  Sentry.captureMessage(message, { level, extra: sanitize(extra) });
}

export function startCompilerOperation(operation, details = {}) {
  const operationId =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const context = { operation, operationId, ...sanitize(details) };
  Sentry.setTag("compiler.operation", operation);
  Sentry.setTag("compiler.operation_id", operationId);
  Sentry.setContext("compiler", context);
  Sentry.addBreadcrumb({
    category: "compiler",
    message: `${operation}.started`,
    level: "info",
    data: context,
  });
  currentCompilerOperation = context;
  return context;
}

export function getCurrentCompilerOperation() {
  return currentCompilerOperation;
}

export function finishCompilerOperation(context, outcome, details = {}) {
  recordCompilerPhase(context, outcome, details);
  if (currentCompilerOperation?.operationId === context.operationId) {
    currentCompilerOperation = null;
  }
}

export function recordCompilerPhase(context, phase, details = {}) {
  const data = { ...context, phase, ...sanitize(details) };
  Sentry.setTag("compiler.phase", phase);
  Sentry.setContext("compiler", data);
  Sentry.addBreadcrumb({
    category: "compiler",
    message: `${context.operation}.${phase}`,
    level: "info",
    data,
  });
}

export function captureCompilerFailure(
  error,
  context,
  phase,
  details = {},
  classification = "compiler-defect",
) {
  const data = sanitize({ ...context, phase, classification, ...details });
  console.error(`[Compiler:${phase}]`, error);
  Sentry.captureException(
    error instanceof Error ? error : new Error(String(error)),
    {
      tags: {
        "compiler.operation": context.operation,
        "compiler.operation_id": context.operationId,
        "compiler.phase": phase,
        "compiler.classification": classification,
      },
      contexts: { compiler: data },
    },
  );
}
