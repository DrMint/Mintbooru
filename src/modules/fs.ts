import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import type { Post } from "modules/data";
import { extensionsFormats } from "modules/upload";

export const createFolderIfMissing = async (path: string) => {
  if (!existsSync(path)) {
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
