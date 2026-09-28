const POWERPOINT_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/** An error page must never be saved as the customer's invitation file. */
export async function readInvitationDownload(response: Response): Promise<{ file: Blob; fileName: string }> {
  const type = response.headers.get("content-type")?.split(";")[0].trim();
  if (!response.ok || (type !== POWERPOINT_TYPE && type !== "application/pdf")) {
    throw new Error("The invitation could not be downloaded.");
  }
  const file = await response.blob();
  if (!file.size) throw new Error("The invitation file is empty.");
  const extension = type === "application/pdf" ? "pdf" : "pptx";
  const suppliedName = response.headers.get("content-disposition")?.match(/filename="([a-z0-9-]+\.(?:pptx|pdf))"/i)?.[1];
  const fileName = suppliedName?.toLowerCase().endsWith(`.${extension}`) ? suppliedName : `jumping-jax-invitations.${extension}`;
  return { file, fileName };
}
