// Fetches one file from the scientist's EasyEyesResources repository on
// Pavlovia, for the preview side of the resource dialog. Returns the file's
// content as base64. It uses the same authenticated client and the same
// helper as the rest of the Compiler.
import { GitLabOAuthClient } from "../../threshold/preprocess/auth/gitlabOAuthClient";
import { getAuthConfig } from "../../threshold/preprocess/auth/config";
import { searchProjectByName } from "../../threshold/preprocess/gitlabSearch";
import { resourcesRepoName } from "../../threshold/preprocess/constants";
import { getBase64FileDataFromGitLab } from "../../threshold/preprocess/fileUtils";

export const makeResourceLoader = (user) => {
  let repoId = null; // looked up once per dialog, on the first preview

  return async (folder, name) => {
    const client = GitLabOAuthClient.loadFromStorage(
      getAuthConfig().clientId,
      getAuthConfig().redirectUri,
    );
    if (!client) throw new Error("Not signed in.");
    if (repoId === null) {
      const repo = await searchProjectByName(user, resourcesRepoName);
      if (!repo) throw new Error("No EasyEyesResources repository.");
      repoId = parseInt(repo.id);
    }
    return getBase64FileDataFromGitLab(repoId, `${folder}/${name}`, client);
  };
};
