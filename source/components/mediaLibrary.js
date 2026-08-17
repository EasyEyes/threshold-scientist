import { getEasyEyesBaseUrl } from "../../threshold/components/easyeyesBaseUrl";
import { loadTokensFromStorage } from "../../threshold/preprocess/auth/storage";

// Media files are addressed through an EasyEyes-owned path rather than a raw
// Google download URL, so that the CORS and Cross-Origin-Resource-Policy
// headers required by remote-calibrator, speaker-calibration, and threshold can
// be set at one edge, and so the backing bucket can change without rewriting
// links already pasted into international phrases.
export const MEDIA_BASE_URL = "https://easyeyes.app/media";

const slug = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const sanitizeMediaFileName = (fileName) => {
  const raw = String(fileName ?? "").trim();
  const lastDot = raw.lastIndexOf(".");
  const hasExtension = lastDot > 0;

  const stem = slug(hasExtension ? raw.slice(0, lastDot) : raw) || "file";
  const extension = hasExtension ? slug(raw.slice(lastDot + 1)) : "";

  return extension ? `${stem}.${extension}` : stem;
};

export const mediaUrlForPath = (path) =>
  `${MEDIA_BASE_URL}/${String(path ?? "").replace(/^\/+/, "")}`;

export const formatFileSize = (bytes) => {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size < 0) return "";
  if (size < 1024) return `${size} B`;

  const units = ["KB", "MB", "GB"];
  let value = size / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }

  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
};

export const formatMediaDate = (timestamp) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

/* -------------------------------------------------------------------------- */
/* Storage. The bucket is its own index: every column the table shows is object
   metadata, so there is no second store to keep in step with it. */

/** Carries a message already fit to show a scientist. */
export class MediaError extends Error {}

const endpoint = async () =>
  `${await getEasyEyesBaseUrl()}/.netlify/functions/media-library`;

export const listMedia = async () => {
  let response;
  try {
    response = await fetch(await endpoint());
  } catch {
    throw new MediaError("Could not reach the media library. Try again.");
  }

  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new MediaError(body?.error ?? "Could not load the media library.");

  return body?.files ?? [];
};

/**
 * Uploads one file and returns its library record.
 *
 * The bytes go straight to Google rather than through the Netlify function,
 * which caps a request body at roughly 6 MB — less than any video. The function
 * only grants permission, in the form of a short-lived upload URL.
 */
export const uploadMedia = async (file, blob = file) => {
  const token = loadTokensFromStorage()?.accessToken;
  if (!token)
    throw new MediaError("Log into Pavlovia before uploading media files.");

  const contentType = blob.type || file.type;

  let granted;
  try {
    const response = await fetch(await endpoint(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: file.name,
        contentType,
        size: blob.size,
      }),
    });

    granted = await response.json().catch(() => null);
    if (!response.ok)
      throw new MediaError(granted?.error ?? `Could not upload ${file.name}.`);
  } catch (err) {
    if (err instanceof MediaError) throw err;
    throw new MediaError("Could not reach the media library. Try again.");
  }

  let stored;
  try {
    stored = await fetch(granted.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: blob,
    });
  } catch {
    throw new MediaError(`${file.name} was interrupted before it finished.`);
  }

  if (!stored.ok)
    throw new MediaError(`${file.name} did not finish uploading.`);

  return {
    path: granted.path,
    url: granted.url,
    name: file.name,
    type: contentType,
    size: blob.size,
    originalSize: file.size,
    addedAt: Date.now(),
    uploadedBy: "",
  };
};
