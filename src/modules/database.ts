import { hashDistance } from "./phash";
import Database from "better-sqlite3";

const db = Database("db.sqlite");
db.pragma("journal_mode = WAL");

enum Tables {
  Posts = "Posts",
  DuplicateEntries = "DuplicateEntries",
}

db.exec(
  `
    CREATE TABLE IF NOT EXISTS ${Tables.Posts} (
      postId INTEGER NOT NULL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      format TEXT NOT NULL,
      createdOn TEXT NOT NULL,
      updatedOn TEXT NOT NULL,
      isOpaque INTEGER NOT NULL,
      isAnimated INTEGER NOT NULL,
      name TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      perceptualHash TEXT NOT NULL
    );
  `
);

db.exec(
  `
    CREATE TABLE IF NOT EXISTS ${Tables.DuplicateEntries} (
      groupId TEXT NOT NULL,
      post INTEGER NOT NULL,
      PRIMARY KEY (groupId, post),
      FOREIGN KEY (post) REFERENCES ${Tables.Posts}(postId)
    );
  `
);

export type Post = {
  postId: number;
  filename: string;
  format: string;
  createdOn: Date;
  updatedOn: Date;
  isOpaque: boolean;
  isAnimated: boolean;
  name: string;
  width: number;
  height: number;
  perceptualHash: string;
};

export type DuplicateEntry = {
  groupId: string;
  post: number;
};

export const getAllPosts = (): Post[] =>
  db.prepare(`SELECT * FROM ${Tables.Posts};`).all() as Post[];

export const getPostById = (postId: number): Post | undefined => {
  return db
    .prepare(`SELECT * FROM ${Tables.Posts} WHERE postId='${postId}'`)
    .get() as Post | undefined;
};

export const createPost = ({
  createdOn,
  filename,
  format,
  height,
  isAnimated,
  isOpaque,
  name,
  perceptualHash,
  updatedOn,
  width,
}: Omit<Post, "postId">): Pick<Post, "postId"> => {
  const { lastInsertRowid } = db
    .prepare(
      `
        INSERT INTO ${Tables.Posts} (
          filename,
          format,
          createdOn,
          updatedOn,
          isOpaque,
          isAnimated,
          name,
          width,
          height,
          perceptualHash
        )
        
        VALUES (
          @filename,
          @format,
          @createdOn,
          @updatedOn,
          @isOpaque,
          @isAnimated,
          @name,
          @width,
          @height,
          @perceptualHash
        );
      `
    )
    .run({
      filename,
      format,
      createdOn: createdOn.toISOString(),
      updatedOn: updatedOn.toISOString(),
      isOpaque: isOpaque ? "TRUE" : "FALSE",
      isAnimated: isAnimated ? "TRUE" : "FALSE",
      name,
      width,
      height,
      perceptualHash,
    });
  return { postId: lastInsertRowid as number };
};

export const getDuplicates = async (
  perceptualHash: string,
  perceptualDistanceThreshold: number
) => {
  const posts = getAllPosts();
  return posts
    .filter(
      (post) =>
        hashDistance(perceptualHash, post.perceptualHash) <=
        perceptualDistanceThreshold
    )
    .map(({ postId }) => postId);
};

export const createDuplicateEntry = (entry: DuplicateEntry) => {
  const { lastInsertRowid } = db
    .prepare(
      `
      INSERT INTO ${Tables.DuplicateEntries} (
        groupId,
        post
      )
      
      VALUES (
        @groupId,
        @post
      );
    `
    )
    .run({ groupId: entry.groupId, post: entry.post });
  return lastInsertRowid;
};

export const getAllDuplicateEntries = (): DuplicateEntry[] =>
  db
    .prepare(`SELECT * FROM ${Tables.DuplicateEntries};`)
    .all() as DuplicateEntry[];

export const getAllPostsGroupedByDuplicates = (): Post[][] => {
  const posts = db
    .prepare(
      `
      SELECT * FROM ${Tables.DuplicateEntries}
        INNER JOIN ${Tables.Posts}
        WHERE ${Tables.DuplicateEntries}.post=${Tables.Posts}.postId;
    `
    )
    .all() as (Post & DuplicateEntry)[];

  return Object.values(Object.groupBy(posts, ({ groupId }) => groupId)).map(
    (group) => group!.map(({ groupId, ...others }) => others)
  );
};
