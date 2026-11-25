export const deriveStudyActions = ({
  repositoryIsEmpty,
  isRunning,
  pavloviaIsReady,
  needsPavloviaCredit = false,
}) => {
  // Pavlovia lets a study be RUNNING without license or credit, then turns
  // participants away, so a compiled study without credit keeps its actions
  // visible, but disabled, whatever its status.
  const blockedByCredit = !repositoryIsEmpty && needsPavloviaCredit;
  const canRun =
    !repositoryIsEmpty && isRunning && pavloviaIsReady && !blockedByCredit;

  return {
    showRun: canRun || blockedByCredit,
    showCreateProlificStudy: canRun || blockedByCredit,
    actionsDisabled: blockedByCredit,
  };
};
