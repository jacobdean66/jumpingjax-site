export function formatAgentTime(value: string) {
  return new Date(value).toLocaleString("en-US", { timeZone: "America/New_York" });
}
