import { Database as BunDatabase } from "bun:sqlite";

enum Tables {
  Posts = "Posts",
  DuplicateEntries = "DuplicateEntries",
}

type BOOLEAN = "TRUE" | "FALSE";
type DATE = string;
type INTEGER = number;
type TEXT = string;

export type DBPost = {
  postId: TEXT;
  format: TEXT;
  createdOn: DATE;
  updatedOn: DATE;
  isOpaque: BOOLEAN;
  isAnimated: BOOLEAN;
  name: TEXT;
  extension: TEXT;
  width: INTEGER;
  height: INTEGER;
  perceptualHash: TEXT;
};

export type DBDuplicateEntry = {
  groupId: TEXT;
  post: DBPost["postId"];
};

export type DBDuplicateEntryJoinedWithPost = DBDuplicateEntry & DBPost;

export class Database {
  private readonly db;

  constructor() {
    this.db = new BunDatabase("./data/db.sqlite", {
      create: true,
      strict: true,
    });
    this.db.run("PRAGMA journal_mode = WAL;");
    this.seed();
  }

  private seed() {
    this.db.run(
      `
        CREATE TABLE IF NOT EXISTS ${Tables.Posts} (
          postId TEXT NOT NULL PRIMARY KEY,
          format TEXT NOT NULL,
          createdOn TEXT NOT NULL,
          updatedOn TEXT NOT NULL,
          isOpaque INTEGER NOT NULL,
          isAnimated INTEGER NOT NULL,
          name TEXT NOT NULL,
          extension TEXT NOT NULL,
          width INTEGER NOT NULL,
          height INTEGER NOT NULL,
          perceptualHash TEXT NOT NULL
        );
      `
    );

    this.db.run(
      `
        CREATE TABLE IF NOT EXISTS ${Tables.DuplicateEntries} (
          groupId TEXT NOT NULL,
          post INTEGER NOT NULL,
          PRIMARY KEY (groupId, post),
          FOREIGN KEY (post) REFERENCES ${Tables.Posts} (postId)
        );
      `
    );
  }

  getPosts(): DBPost[] {
    return this.db.query(`SELECT * FROM ${Tables.Posts};`).all() as DBPost[];
  }

  getPostById = (postId: DBPost["postId"]): DBPost | undefined => {
    return this.db
      .query(`SELECT * FROM ${Tables.Posts} WHERE postId = ?1;`)
      .get(postId) as DBPost | undefined;
  };

  insertPost(post: DBPost): void {
    this.db
      .query(
        `
        INSERT INTO ${Tables.Posts} (
          postId,
          format,
          createdOn,
          updatedOn,
          isOpaque,
          isAnimated,
          name,
          extension,
          width,
          height,
          perceptualHash
        )
        
        VALUES (
          @postId,
          @format,
          @createdOn,
          @updatedOn,
          @isOpaque,
          @isAnimated,
          @name,
          @extension,
          @width,
          @height,
          @perceptualHash
        );
      `
      )
      .run(post);
  }

  getDuplicateEntries(): DBDuplicateEntry[] {
    return this.db
      .query(`SELECT * FROM ${Tables.DuplicateEntries};`)
      .all() as DBDuplicateEntry[];
  }

  getDuplicateEntriesJoinedWithPost(): DBDuplicateEntryJoinedWithPost[] {
    return this.db
      .query(
        `
      SELECT * FROM ${Tables.DuplicateEntries}
        INNER JOIN ${Tables.Posts}
        WHERE ${Tables.DuplicateEntries}.post = ${Tables.Posts}.postId;
    `
      )
      .all() as DBDuplicateEntryJoinedWithPost[];
  }

  insertDuplicateEntry = (entry: DBDuplicateEntry): void => {
    this.db
      .query(
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
      .run(entry);
  };
}
