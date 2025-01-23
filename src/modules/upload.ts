import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { randomUUID } from "crypto";
import sharp, { type FormatEnum } from "sharp";
import { phash } from "./phash";
import {
  createDuplicateEntry,
  createPost,
  getAllDuplicateEntries,
  getDuplicates,
} from "./database";

const perceptualDistanceThreshold = 10;

export const acceptedUploadMimes = [
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const acceptedSharpFormats = [
  "avif",
  "gif",
  "jpg",
  "jpeg",
  "png",
  "webp",
] satisfies (keyof FormatEnum)[];

type AcceptedSharpFormat = (typeof acceptedSharpFormats)[number];

const extensionsFormats: Record<AcceptedSharpFormat, string> = {
  avif: ".avif",
  gif: ".gif",
  jpg: ".jpg",
  jpeg: ".jpg",
  png: ".png",
  webp: ".webp",
};

const isFormatAcceptable = (
  format: keyof FormatEnum
): format is AcceptedSharpFormat =>
  acceptedSharpFormats.includes(format as unknown as AcceptedSharpFormat);

const uploadFolder = "./public/uploads";

type UploadResult = {
  message: string;
  status: number;
  id?: number;
  filename?: string;
};

export const handleUploads = async (
  request: Request
): Promise<UploadResult[]> => {
  let data;
  try {
    data = await request.formData();
  } catch (e) {
    console.warn("[HandleUpload] Failure to parse formData", e);
    return [
      {
        message: "The submitted request is not a form.",
        status: 400,
      },
    ];
  }

  const files = data.getAll("file");

  if (files.length === 0) {
    return [
      {
        message: "The submitted form doesn't include file(s).",
        status: 400,
      },
    ];
  }

  // See if we can do it in parallel with a Promise.all
  const result = [];
  let i = 1;
  for (const file of files) {
    console.log("Handling file", i, "/", files.length);
    result.push(await handleUpload(file));
    i++;
  }

  return result;
};

const handleUpload = async (
  file: FormDataEntryValue
): Promise<UploadResult> => {
  if (!(file instanceof File)) {
    return {
      message: "The submitted entry is not actually a file",
      status: 400,
    };
  }

  if (!acceptedUploadMimes.includes(file.type)) {
    return {
      message: "The submitted file is not one of our supported image format.",
      status: 400,
    };
  }

  const now = new Date();
  const name = path.basename(file.name, path.extname(file.name));
  const buffer = await file.arrayBuffer();

  const image = sharp(buffer);

  const { width, height, loop, format } = await image.metadata();
  const { isOpaque } = await image.stats();
  const perceptualHash = await phash(image);

  if (width === undefined || height === undefined || format === undefined) {
    return {
      message: "The provided image seems corrupted.",
      status: 400,
    };
  }

  if (!isFormatAcceptable(format)) {
    return {
      message: "The submitted file is not one of our supported image format.",
      status: 400,
    };
  }

  const extension = extensionsFormats[format];
  const filename = randomUUID() + extension;
  const filePath = `./public/uploads/${filename}`;

  try {
    if (!existsSync(uploadFolder)) {
      await fs.mkdir(uploadFolder);
    }
    await fs.writeFile(filePath, file.stream());
  } catch (e) {
    console.warn("[HandleUpload] Failure to write file to disk:", e);
    return {
      message: "For some reason we couldn't save the image on our hand.",
      status: 500,
    };
  }

  // Get the duplicates before inserting the post
  // otherwise the post would always be its own duplicate.
  const duplicates = await getDuplicates(
    perceptualHash,
    perceptualDistanceThreshold
  );

  let postId;
  try {
    postId = createPost({
      name,
      filename,
      format,
      height,
      width,
      isOpaque,
      isAnimated: loop !== undefined,
      createdOn: now,
      updatedOn: now,
      perceptualHash,
    }).postId;

    if (!postId) throw new Error("No inserted row");
  } catch (e) {
    console.warn("[HandleUpload] Failure to insert post in DB:", e);
    return {
      message: "For some reason we couldn't add the image to the database.",
      status: 500,
    };
  }

  if (duplicates.length > 0) {
    await handleDuplicates(postId, duplicates);
  }

  return {
    message: "The image was uploaded!",
    status: 200,
    id: postId,
    filename: file.name,
  };
};

const handleDuplicates = async (postId: number, duplicates: number[]) => {
  console.log("Handling duplicates for", postId, duplicates);

  const groups = Object.entries(
    Object.groupBy(
      getAllDuplicateEntries().filter(({ post }) => duplicates.includes(post)),
      ({ groupId }) => groupId
    )
  ).map(([groupId, entries]) => ({
    groupId,
    posts: entries!.map(({ post }) => post),
  }));

  // Add myself to all the existing duplicate groups
  groups.map(({ groupId }) => createDuplicateEntry({ groupId, post: postId }));

  const duplicatesNotInAGroup = duplicates.filter(
    (postId) => !groups.flatMap(({ posts }) => posts).includes(postId)
  );

  // For those not already in a duplicate group, create a new group
  if (duplicatesNotInAGroup.length > 0) {
    duplicatesNotInAGroup.push(postId); // Add myself to the group
    const groupId = randomUUID();
    duplicatesNotInAGroup.map((post) => createDuplicateEntry({ groupId, post }));
  }
};
