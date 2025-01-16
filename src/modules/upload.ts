import { Posts } from "astro:db";
import { db } from "astro:db";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";

export const acceptedUploadMimes = [
  "image/apng",
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const uploadFolder = "./public/uploads";

type UploadResult = { message: string; status: number };

export const handleUpload = async (request: Request): Promise<UploadResult> => {
  let data;
  try {
    data = await request.formData();
  } catch (e) {
    console.warn("[HandleUpload] Failure to parse formData", e);
    return {
      message: "The submitted request is not a form.",
      status: 400,
    };
  }

  const file = data.get("file");

  if (!file) {
    return {
      message: "The submitted form doesn't include a file.",
      status: 400,
    };
  }

  if (!(file instanceof File)) {
    return {
      message: "The submitted file is not actually a file",
      status: 400,
    };
  }

  if (!acceptedUploadMimes.includes(file.type)) {
    return {
      message: "The submitted file is not one of our supported image format.",
      status: 400,
    };
  }

  const extension = path.extname(file.name);
  const name = path.basename(file.name, extension);

  let id;
  try {
    const result = (
      await db
        .insert(Posts)
        .values({ name, extension })
        .returning({ id: Posts.id })
    )[0];

    if (!result) throw new Error("No inserted row");
    id = result.id;
  } catch (e) {
    console.warn("[HandleUpload] Failure to insert post in DB:", e);
    return {
      message: "For some reason we couldn't add the image to the database.",
      status: 500,
    };
  }

  try {
    if (!existsSync(uploadFolder)) {
      await fs.mkdir(uploadFolder);
    }
    await fs.writeFile(`./public/uploads/${id}${extension}`, file.stream());
  } catch (e) {
    console.warn("[HandleUpload] Failure to write file to disk:", e);
    return {
      message: "For some reason we couldn't save the image on our hand.",
      status: 500,
    };
  }

  return {
    message: "The image was uploaded!",
    status: 200,
  };
};
