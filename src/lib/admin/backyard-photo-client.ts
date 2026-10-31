"use client";

/** Prepare camera photos within the hosting upload limit; the server verifies and re-encodes again. */
export async function prepareBackyardPhoto(file: File): Promise<File> {
  if (file.size > 20 * 1024 * 1024) throw new Error("Choose photos smaller than 20 MB each.");
  let image: ImageBitmap;
  try { image = await createImageBitmap(file); }
  catch { throw new Error("This photo format could not be read. Please choose a JPG, PNG or WebP photo."); }
  try {
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Photos could not be prepared in this browser.");
    context.fillStyle = "white"; context.fillRect(0,0,canvas.width,canvas.height); context.drawImage(image,0,0,canvas.width,canvas.height);
    for (const quality of [0.82,0.66,0.48]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve,"image/jpeg",quality));
      if (blob && blob.size <= 1024 * 1024) return new File([blob], "backyard.jpg", { type: "image/jpeg" });
    }
    throw new Error("This photo is too large to upload. Please choose a smaller image.");
  } finally { image.close(); }
}
