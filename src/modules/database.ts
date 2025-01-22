import { db, eq, Posts } from "astro:db";
import { hashDistance } from "./phash";

export type Post = NonNullable<Awaited<ReturnType<typeof getPostById>>>;

export const getAllPosts = () => db.select().from(Posts);

export const getPostById = async (id: number) => {
  const result = await getAllPosts().where(eq(Posts.id, id));
  if (result.length === 0) return null;
  return result[0];
};

export const getDuplicates = async (
  perceptualHash: string,
  perceptualDistanceThreshold: number
) => {
  const posts = await getAllPosts();
  return posts
    .filter(
      (post) =>
        hashDistance(perceptualHash, post.perceptualHash) <=
        perceptualDistanceThreshold
    )
    .map(({ id }) => id);
};
