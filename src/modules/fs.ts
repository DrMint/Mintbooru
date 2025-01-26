import { exists, mkdir } from "node:fs/promises";
import type { Post } from "modules/data";

export const createFolderIfMissing = async (path: string) => {
  if (!(await exists(path))) {
    await mkdir(path, { recursive: true });
  }
};

export const getPostImageSrc = (
  post: Post,
  format: "thumb" | "original" | "og" | "medium"
): string => {
  const extension =
    format === "original" ? post.extension : format === "og" ? ".jpg" : ".webp";
  return `/api/assets/${format}/${post.postId}${extension}`;
};

export const writeFile = async (
  destination: string,
  data: File | ArrayBuffer
) => {
  await Bun.write(destination, data);
};
