import { db, eq, Posts } from "astro:db";

export const getAllPosts = () => db.select().from(Posts);

export const getPostById = async (id: number) => {
  const result = await getAllPosts().where(eq(Posts.id, id));
  if (result.length === 0) return null;
  return result[0];
};
