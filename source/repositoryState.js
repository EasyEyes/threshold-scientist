export const isEmptyRepository = (repository) =>
  repository?.empty_repo === true || repository?.default_branch === null;
