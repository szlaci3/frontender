export interface Source {
  url: string;
  name: string;
  width: number;
  height: number;
}
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("This image could not be decoded."));
    i.src = url;
  });
}
export async function upload(file: File): Promise<Source> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Choose a PNG, JPG or WebP image.");
  if (file.size > 12 * 1024 * 1024)
    throw new Error("Choose an image smaller than 12 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    if (
      image.width * image.height > 40_000_000 ||
      image.width > 40000 ||
      image.height > 40000
    )
      throw new Error("Image is too large. Use at most 40 megapixels.");
    return { url, name: file.name, width: image.width, height: image.height };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}
export async function aiImage(source: Source) {
  const image = await loadImage(source.url),
    scale = Math.min(1, 1400 / image.width, 1400 / image.height);
  const c = document.createElement("canvas");
  c.width = Math.round(image.width * scale);
  c.height = Math.round(image.height * scale);
  c.getContext("2d")!.drawImage(image, 0, 0, c.width, c.height);
  const data = c.toDataURL("image/png");
  if (data.length < 1_950_000) return data;
  const ctx = c.getContext("2d")!;
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}
export async function cropImage(
  source: Source,
  crop: { x: number; y: number; width: number; height: number },
): Promise<Source> {
  const image = await loadImage(source.url),
    c = document.createElement("canvas");
  c.width = Math.max(1, Math.round((image.width * crop.width) / 100));
  c.height = Math.max(1, Math.round((image.height * crop.height) / 100));
  c.getContext("2d")!.drawImage(
    image,
    (image.width * crop.x) / 100,
    (image.height * crop.y) / 100,
    (image.width * crop.width) / 100,
    (image.height * crop.height) / 100,
    0,
    0,
    c.width,
    c.height,
  );
  return {
    url: c.toDataURL("image/png"),
    name: "border-crop.png",
    width: c.width,
    height: c.height,
  };
}
export function download(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
}
