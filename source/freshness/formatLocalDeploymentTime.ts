const formatUtcOffset = (date: Date, timeZone: string): string => {
  const timeZoneName = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  })
    .formatToParts(date)
    .find(({ type }) => type === "timeZoneName")?.value;

  if (!timeZoneName || timeZoneName === "GMT") return "UTC+0";
  return timeZoneName.replace("GMT", "UTC").replace(":00", "");
};

export const formatLocalDeploymentTime = (
  value: string | Date,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): string => {
  const date = value instanceof Date ? value : new Date(value);
  const localDateAndTime = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(date);

  return `${localDateAndTime} ${formatUtcOffset(date, timeZone)}`;
};
