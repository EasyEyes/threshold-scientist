export const deriveStudyActions = ({
  repositoryIsEmpty,
  isRunning,
  pavloviaIsReady,
}) => {
  const canRun = !repositoryIsEmpty && isRunning && pavloviaIsReady;

  return {
    showRun: canRun,
    showCreateProlificStudy: canRun,
  };
};
