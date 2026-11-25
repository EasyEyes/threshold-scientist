// What each folder in the scientist's Pavlovia account holds: images or
// sounds.
//
// A folder is a zip file in the "folders" directory of the EasyEyesResources
// repository. A study refers to one by name (targetImageFolder,
// targetSoundFolder, maskerSoundFolder). The Compiler lists a folder of
// images under Images and a folder of sounds under Sound, and has no
// "folders" button (Denis: a scientist should not have to look in a different
// place for one file and for a folder of files).
//
// The repository's listing gives only names, so to learn what a folder holds
// the zip is downloaded and its list of files read. That is done once per
// folder: the answer is remembered in this browser against the file's id on
// Pavlovia, which changes whenever the file is replaced. Folders are read one
// at a time, in the background.
//
// Until a folder has been read, and whenever it holds both kinds, neither
// kind, or cannot be read, its kind is "both", and it is listed under both
// Images and Sound, so no folder is ever hidden.
import JSZip from "jszip";

import { GitLabOAuthClient } from "../../threshold/preprocess/auth/gitlabOAuthClient";
import { getAuthConfig } from "../../threshold/preprocess/auth/config";
import { searchProjectByName } from "../../threshold/preprocess/gitlabSearch";
import {
  acceptableExtensions,
  resourcesRepoName,
} from "../../threshold/preprocess/constants";
import { getBase64FileDataFromGitLab } from "../../threshold/preprocess/fileUtils";

const SOUND_EXTENSIONS = ["wav"]; // the only sound format a study can use
const CACHE_KEY = "easyeyes.folderKinds.v1";

/** The kind to assume for a folder that has not been read. */
export const UNKNOWN_KIND = "both";

/**
 * "images", "sound" or "both", from the names of the files in a folder.
 * Entries the operating system adds (__MACOSX, .DS_Store) do not count.
 */
export const kindOfFileNames = (fileNames) => {
  let images = false;
  let sound = false;
  for (const path of fileNames) {
    if (path.endsWith("/") || path.includes("__MACOSX")) continue;
    const name = path.split("/").pop();
    if (!name || name.startsWith(".")) continue;
    const extension = (/\.([A-Za-z0-9]+)$/.exec(name)?.[1] ?? "").toLowerCase();
    if (acceptableExtensions.images.includes(extension)) images = true;
    else if (SOUND_EXTENSIONS.includes(extension)) sound = true;
  }
  if (images && !sound) return "images";
  if (sound && !images) return "sound";
  return "both";
};

/** Whether a folder of this kind belongs in a category ("images" or "sound"). */
export const folderBelongsIn = (kind, category) =>
  (kind ?? UNKNOWN_KIND) === "both" || kind === category;

const browserCache = {
  read() {
    try {
      return JSON.parse(window.localStorage.getItem(CACHE_KEY)) ?? {};
    } catch {
      return {};
    }
  },
  write(kinds) {
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(kinds));
    } catch {
      // Storage full or blocked: the folders are simply read again next time.
    }
  },
};

/**
 * Work out the kind of each named folder and report each as it is known.
 * The network and the storage are passed in, so this can be tested alone.
 *
 * @param {object} options
 * @param {string[]} options.names Folder file names, e.g. "faces.zip".
 * @param {() => Promise<Record<string, string>>} options.listIds
 *   The id of each file in the folders directory, by name.
 * @param {(name: string) => Promise<string[]>} options.readFileNames
 *   The names of the files inside one folder.
 * @param {{read: () => object, write: (kinds: object) => void}} options.cache
 * @param {(name: string, kind: string) => void} options.onKind
 * @param {() => boolean} [options.isCancelled]
 */
export const classifyFolders = async ({
  names,
  listIds,
  readFileNames,
  cache,
  onKind,
  isCancelled = () => false,
}) => {
  if (!names.length) return;
  const ids = await listIds();
  if (isCancelled()) return;
  const known = cache.read();
  const unread = [];
  for (const name of names) {
    const id = ids[name];
    if (id && known[id]) onKind(name, known[id]);
    else unread.push(name);
  }
  for (const name of unread) {
    if (isCancelled()) return;
    try {
      const kind = kindOfFileNames(await readFileNames(name));
      if (isCancelled()) return;
      const id = ids[name];
      if (id) cache.write({ ...cache.read(), [id]: kind });
      onKind(name, kind);
    } catch {
      // Could not be read: it stays listed under both, and is tried again
      // the next time the page loads.
    }
  }
};

const PAGE_SIZE = 100;

/**
 * The real thing: reads the signed-in scientist's folders from Pavlovia.
 * Does nothing when nobody is signed in or there is no resources repository.
 */
export const loadFolderKinds = async (user, names, onKind, isCancelled) => {
  if (!user || !names.length) return;
  const client = GitLabOAuthClient.loadFromStorage(
    getAuthConfig().clientId,
    getAuthConfig().redirectUri,
  );
  if (!client) return;
  try {
    const repo = await searchProjectByName(user, resourcesRepoName);
    if (!repo) return;
    const repoId = parseInt(repo.id);
    await classifyFolders({
      names,
      cache: browserCache,
      onKind,
      isCancelled,
      listIds: async () => {
        const ids = {};
        for (let page = 1; page <= 20; page++) {
          const response = await client.apiRequest(
            `/projects/${repoId}/repository/tree/?path=folders&per_page=${PAGE_SIZE}&page=${page}`,
          );
          const entries = await response.json();
          if (!Array.isArray(entries)) break;
          for (const entry of entries)
            if (entry?.type === "blob") ids[entry.name] = entry.id;
          if (entries.length < PAGE_SIZE) break;
        }
        return ids;
      },
      readFileNames: async (name) => {
        const base64 = await getBase64FileDataFromGitLab(
          repoId,
          `folders/${name}`,
          client,
        );
        const zip = await JSZip.loadAsync(base64.replace(/\s/g, ""), {
          base64: true,
        });
        return Object.keys(zip.files);
      },
    });
  } catch {
    // Offline, signed out meanwhile, or Pavlovia refused: every folder stays
    // listed under both Images and Sound.
  }
};
