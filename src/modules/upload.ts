import path from "path";
import sharp from "sharp";
import { phash } from "modules/phash";
import { data, type Post } from "modules/data";
import { createFolderIfMissing, writeFile } from "modules/fs";
import { generateId } from "modules/nanoid";

const perceptualDistanceThreshold = 10;

const uploadFolder = "./data/assets";

type UploadResult = {
  message: string;
  status: number;
  post?: Post;
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

  const now = new Date();
  const extension = path.extname(file.name);
  const name = path.basename(file.name);
  const buffer = await file.arrayBuffer();

  let image;
  let meta;
  try {
    image = sharp(buffer, { animated: true });
    meta = await image.metadata();
  } catch (e) {
    if (
      e instanceof Error &&
      e.message === "Input buffer contains unsupported image format"
    ) {
      return {
        message: `The submitted file format is not supported.`,
        filename: file.name,
        status: 400,
      };
    }

    return {
      message: "Something bad happened.",
      filename: file.name,
      status: 500,
    };
  }

  let { width, height, loop, delay, format } = meta;
  if (loop !== undefined && loop > 65535) {
    loop = 65535;
  }
  const { isOpaque } = await image.stats();
  const perceptualHash = await phash(image);

  if (width === undefined || height === undefined || format === undefined) {
    return {
      message: "The provided image seems corrupted.",
      filename: file.name,
      status: 400,
    };
  }

  const postId = generateId();

  const thumbFolder = path.join(uploadFolder, "thumb");
  const mediumFolder = path.join(uploadFolder, "medium");
  const originalFolder = path.join(uploadFolder, "original");
  const openGraphFolder = path.join(uploadFolder, "og");

  const thumbPath = path.join(thumbFolder, postId + ".webp");
  const mediumPath = path.join(mediumFolder, postId + ".webp");
  const originalPath = path.join(originalFolder, postId + extension);
  const openGraphPath = path.join(openGraphFolder, postId + ".jpg");

  await createFolderIfMissing(thumbFolder);
  await createFolderIfMissing(mediumFolder);
  await createFolderIfMissing(originalFolder);
  await createFolderIfMissing(openGraphFolder);

  const thumb = image
    .clone()
    .resize({
      width: 256,
      height: 256,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      alphaQuality: 50,
      quality: 50,
      effort: 4,
      loop,
      delay,
      force: true,
    });
  await thumb.toFile(thumbPath);
  thumb.destroy();

  const medium = image
    .clone()
    .resize({
      width: 1024,
      height: 1024,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      alphaQuality: 80,
      quality: 80,
      effort: 4,
      loop,
      delay,
      force: true,
    });
  await medium.toFile(mediumPath);
  medium.destroy();

  const openGraph = sharp(buffer)
    .resize({
      width: 256,
      height: 256,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({
      quality: 50,
      progressive: true,
      optimizeCoding: true,
      mozjpeg: true,
      force: true,
    });
  await openGraph.toFile(openGraphPath);
  openGraph.destroy();
  image.destroy();

  await writeFile(originalPath, buffer);

  // Get the duplicates before inserting the post
  // otherwise the post would always be its own duplicate.
  const duplicatesIds = data
    .getDuplicates(perceptualHash, perceptualDistanceThreshold)
    .map(({ postId }) => postId);

  try {
    data.createPost({
      postId,
      name,
      extension,
      format,
      height,
      width,
      isOpaque,
      isAnimated: loop !== undefined,
      createdOn: now,
      updatedOn: now,
      perceptualHash,
    });

    if (!postId) throw new Error("No inserted row");
  } catch (e) {
    console.warn("[HandleUpload] Failure to insert post in DB:", e);
    return {
      message: "For some reason we couldn't add the image to the database.",
      filename: file.name,
      status: 500,
    };
  }

  if (duplicatesIds.length > 0) {
    await handleDuplicates(postId, duplicatesIds);
  }

  return {
    message: "The image was uploaded!",
    status: 200,
    post: data.getPost(postId),
    filename: file.name,
  };
};

const handleDuplicates = async (
  postId: Post["postId"],
  duplicatesIds: Post["postId"][]
) => {
  console.log("Handling duplicates for", postId, duplicatesIds);

  const groups = data
    .getDuplicatesGroups()
    .filter(({ posts }) =>
      posts.some(({ postId }) => duplicatesIds.includes(postId))
    );

  // Add myself to all the existing duplicate groups
  groups.map(({ groupId }) => data.declareDuplicate(groupId, postId));

  const allPostsIdsInDuplicatesGroups = groups.flatMap(({ posts }) =>
    posts.map(({ postId }) => postId)
  );

  const duplicatesNotInAGroup = duplicatesIds.filter(
    (postId) => !allPostsIdsInDuplicatesGroups.includes(postId)
  );

  // For those not already in a duplicate group, create a new group
  if (duplicatesNotInAGroup.length > 0) {
    duplicatesNotInAGroup.push(postId); // Add myself to the group
    const groupId = generateId();
    duplicatesNotInAGroup.map((duplicate) =>
      data.declareDuplicate(groupId, duplicate)
    );
  }
};
