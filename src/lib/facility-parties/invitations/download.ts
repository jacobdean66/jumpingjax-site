const POWERPOINT_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/** An error page must never be saved as the customer's invitation file. */
export async function readInvitationDownload(response: Response): Promise<{ file: Blob; fileName: string }> {
  if (!response.ok || response.headers.get("content-type")?.split(";")[0].trim() !== POWERPOINT_TYPE) {
    throw new Error("The invitation could not be downloaded.");
  }
  const file = await response.blob();
  if (!file.size) throw new Error("The invitation file is empty.");
  const suppliedName = response.headers.get("content-disposition")?.match(/filename="([a-z0-9-]+\.pptx)"/i)?.[1];
  return { file, fileName: suppliedName || "jumping-jax-invitations.pptx" };
}
