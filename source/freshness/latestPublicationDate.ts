const isValidDate = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

export const latestPublicationDate = (
  ...candidates: unknown[]
): string | null => {
  const validDates = candidates.filter(isValidDate);
  if (validDates.length === 0) return null;

  return validDates.reduce((latest, candidate) =>
    Date.parse(candidate) > Date.parse(latest) ? candidate : latest,
  );
};
