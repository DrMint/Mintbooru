import { exists, mkdir } from "node:fs/promises";
import type { Post } from "modules/data";
import { extensionsFormats } from "modules/upload";

export const createFolderIfMissing = async (path: string) => {
  if (!(await exists(path))) {
    await mkdir(path, { recursive: true });
  }
};

export const getPostImageSrc = (
  post: Post,
  format: "thumb" | "original" | "openGraph" | "medium"
): string => {
  const extension =
    format === "original"
      ? extensionsFormats[post.format]
      : format === "openGraph"
      ? extensionsFormats["jpg"]
      : extensionsFormats["webp"];
  return `/uploads/${format}/${post.postId}${extension}`;
};

export const writeFile = async (
  destination: string,
  data: File | ArrayBuffer
) => {
  await Bun.write(destination, data);
};
