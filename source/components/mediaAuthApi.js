import { getEasyEyesBaseUrl } from "../../threshold/components/easyeyesBaseUrl";
import { loadTokensFromStorage } from "../../threshold/preprocess/auth/storage";

export const VIEWER_ACCESS = {
  role: "viewer",
  permissions: { upload: false, manage: false },
};

/**
 * Asks the server what the current Pavlovia account may do in the media
 * library. The answer decides what the interface offers; it is not the barrier
 * itself, because anything decided in the browser can be edited there. The
 * upload endpoint repeats the same check before writing.
 */
export async function fetchMediaAccess() {
  const token = loadTokensFromStorage()?.accessToken;
  if (!token)
    return {
      ...VIEWER_ACCESS,
      error: "Log in to Pavlovia to upload media files.",
    };

  try {
    const response = await fetch(
      `${await getEasyEyesBaseUrl()}/.netlify/functions/media-auth`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } },
    );
    const body = await response.json();

    if (!response.ok)
      return {
        ...VIEWER_ACCESS,
        error: body?.error ?? "Could not check your account.",
      };

    return { ...VIEWER_ACCESS, ...body };
  } catch {
    return {
      ...VIEWER_ACCESS,
      error: "Could not check your account just now. Try again.",
    };
  }
}
