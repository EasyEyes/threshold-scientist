// Media files are addressed through an EasyEyes-owned hostname rather than a
// raw Firebase download URL, so that the CORS and Cross-Origin-Resource-Policy
// headers required by remote-calibrator, speaker-calibration, and threshold can
// be set at one edge, and so the backing bucket can change without rewriting
// links already pasted into international phrases.
export const MEDIA_BASE_URL = "https://media.easyeyes.app";

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
/* Storage seam. Uploads currently live only in this browser session; replacing
   the two functions below with Firebase Storage calls is the whole of the
   backend wiring. */

let sessionLibrary = [];

export const listMedia = () => [...sessionLibrary];

export const addMedia = (record) => {
  sessionLibrary = [record, ...sessionLibrary];
  return record;
};

export const isNameTaken = (path) =>
  sessionLibrary.some((record) => record.path === path);

export const resetMediaLibrary = () => {
  sessionLibrary = [];
};
