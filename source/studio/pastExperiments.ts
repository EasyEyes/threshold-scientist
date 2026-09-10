/**
 * Open a past compiled experiment in the Studio.
 *
 * Every compile leaves the scientist's experiment table in the root of the
 * experiment repository on Pavlovia — `<name>.csv` as text, or, for a
 * spreadsheet upload, a file that keeps its `.xlsx` name but holds the first
 * sheet as JSON rows (threshold/preprocess/fileUtils.ts readXLSXFile). The
 * Compiler tab's "Select compiled study" list only lets you run such an
 * experiment; the Studio reads the table back into its grid, where it can be
 * edited and compiled again. That compile is a new experiment (the compiler
 * picks a free name, as when the same table is dropped twice) — the past
 * experiment itself is never changed.
 *
 * Lists come from the same GitLab calls the Compiler tab's list uses: page 1
 * is the compiler page's own `user.projectList`, further pages and searches
 * are fetched on demand. Studio-only; nothing here touches the compile.
 */
import { resourcesRepoName } from "../../threshold/preprocess/constants";
import { getAuthConfig } from "../../threshold/preprocess/auth/config";
import { GitLabOAuthClient } from "../../threshold/preprocess/auth/gitlabOAuthClient";
import { fetchAllPages } from "../../threshold/preprocess/fetchAllPages";
import { getTextFileDataFromGitLab } from "../../threshold/preprocess/fileUtils";
import { searchProjectsByName } from "../../threshold/preprocess/gitlabSearch";
import {
  getProjectsPage,
  type User,
} from "../../threshold/preprocess/gitlabUtils";
import { repoTableToMatrix } from "./fileImport";

export interface PastExperiment {
  id: number;
  name: string;
  /** ISO date the repository was created — the compile's date. */
  created_at: string;
}

export interface PastExperimentTable {
  /** The experiment (repository) name — the Studio's suggested name. */
  name: string;
  /** The table file found in the repository root. */
  fileName: string;
  matrix: string[][];
}

export interface PastExperimentList {
  experiments: PastExperiment[];
  /** How many pages of 100 the scientist's project list has. */
  totalPages: number;
}

export interface PastExperimentsApi {
  /**
   * Page 1 of the scientist's experiments — the compiler page's own list,
   * unless `refresh` asks Pavlovia again (after a compile in another tab).
   */
  list(refresh?: boolean): Promise<PastExperimentList>;
  /** A further page (2, 3, …) of the same list. */
  page(n: number): Promise<PastExperiment[]>;
  /** Pavlovia's own name search across every page. */
  search(term: string): Promise<PastExperiment[]>;
  /** The experiment's table, read from its repository. */
  open(experiment: PastExperiment): Promise<PastExperimentTable>;
}

/** The file a compile stores the table under: the first csv/xlsx in the root. */
export const isTableFileName = (name: string): boolean =>
  /\.(csv|xlsx)$/i.test(name) && name !== "recruitmentServiceConfig.csv";

/** Experiments only — the resources repository is in the same project list. */
export const asExperiments = (projects: unknown[]): PastExperiment[] =>
  (projects ?? []).filter(
    (p: any): p is PastExperiment =>
      Boolean(p) &&
      p.id !== undefined &&
      typeof p.name === "string" &&
      p.name !== resourcesRepoName,
  );

const loadClient = (): GitLabOAuthClient => {
  const config = getAuthConfig();
  const client = GitLabOAuthClient.loadFromStorage(
    config.clientId,
    config.redirectUri,
  );
  if (!client) throw new Error("Not signed in to Pavlovia.");
  return client;
};

/**
 * The name of the table file in the repository root, or null when the
 * repository has none (an experiment not made by the compiler, or made by a
 * version that did not keep the table).
 */
export const findTableFileName = async (
  projectId: number,
  client: GitLabOAuthClient,
): Promise<string | null> => {
  const responses = await fetchAllPages(
    `/projects/${projectId}/repository/tree/?path=%2E`,
    client,
  );
  const entries = (await Promise.all(responses.map((r) => r.json()))).flat();
  const file = entries.find(
    (e: any) => e && e.type !== "tree" && isTableFileName(e.name),
  );
  return file ? file.name : null;
};

export const openPastExperiment = async (
  experiment: PastExperiment,
  client: GitLabOAuthClient = loadClient(),
): Promise<PastExperimentTable> => {
  const fileName = await findTableFileName(experiment.id, client);
  if (!fileName)
    throw new Error(
      `“${experiment.name}” has no experiment table in its repository, so it cannot be opened in the Studio.`,
    );
  const text = await getTextFileDataFromGitLab(experiment.id, fileName, client);
  return {
    name: experiment.name,
    fileName,
    matrix: repoTableToMatrix(fileName, text),
  };
};

/** The Studio's view of the signed-in scientist's compiled experiments. */
export const makePastExperimentsApi = (user: User): PastExperimentsApi => ({
  async list(refresh = false) {
    if (refresh) await user.initProjectList(true);
    const projects = await user.projectList;
    return {
      experiments: asExperiments(projects),
      totalPages: user.totalProjectPages || 1,
    };
  },
  async page(n) {
    return asExperiments(await getProjectsPage(user, n));
  },
  async search(term) {
    return asExperiments(await searchProjectsByName(user, term));
  },
  open(experiment) {
    return openPastExperiment(experiment);
  },
});
