/** Deployment/proxy error pages must never surface parser details to customers. */
export async function readThemeResponse(response: Response) {
  const data = await response.json().catch(() => null);
  const fallback = "The theme service couldn’t finish. Please try again. Your selection has been kept.";
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(fallback);
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : fallback);
  return data;
}
