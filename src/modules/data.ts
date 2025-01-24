import { Database, type DBPost } from "modules/database";
import { hashDistance } from "modules/phash";
import type { AcceptedSharpFormat } from "modules/upload";

export type Post = {
  postId: string;
  format: AcceptedSharpFormat;
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
  post: Post["postId"];
};

export type DuplicateGroup = {
  groupId: string;
  posts: Post[];
};

class Data {
  constructor(private readonly db: Database) {}

  getPosts(): Post[] {
    return this.db.getPosts().map(Data.convertDBPostToPost);
  }

  getPost(postId: Post["postId"]): Post | undefined {
    const post = this.db.getPostById(postId);
    if (!post) return undefined;
    return Data.convertDBPostToPost(post);
  }

  getDuplicatesGroups(): DuplicateGroup[] {
    const duplicateEntries = this.db.getDuplicateEntriesJoinedWithPost();
    return Object.entries(
      Object.groupBy(duplicateEntries, ({ groupId }) => groupId)
    ).map(([groupId, entries]) => ({
      groupId,
      posts: entries?.map(Data.convertDBPostToPost) ?? [],
    }));
  }

  getDuplicates(
    perceptualHash: string,
    perceptualDistanceThreshold: number
  ): Post[] {
    const posts = this.db.getPosts();
    return posts
      .filter(
        (post) =>
          hashDistance(perceptualHash, post.perceptualHash) <=
          perceptualDistanceThreshold
      )
      .map(Data.convertDBPostToPost);
  }

  createPost(post: Post): void {
    this.db.insertPost(Data.convertPostInsertionToDBPostInsertion(post));
  }

  declareDuplicate(
    duplicateGroupId: DuplicateEntry["groupId"],
    postId: Post["postId"]
  ) {
    this.db.insertDuplicateEntry({ groupId: duplicateGroupId, post: postId });
  }

  private static convertPostInsertionToDBPostInsertion({
    createdOn,
    updatedOn,
    isAnimated,
    isOpaque,
    ...others
  }: Post): DBPost {
    return {
      ...others,
      createdOn: createdOn.toISOString(),
      updatedOn: updatedOn.toISOString(),
      isAnimated: isAnimated ? "TRUE" : "FALSE",
      isOpaque: isOpaque ? "TRUE" : "FALSE",
    };
  }

  private static convertDBPostToPost({
    createdOn,
    updatedOn,
    isAnimated,
    isOpaque,
    format,
    ...others
  }: DBPost): Post {
    return {
      ...others,
      createdOn: new Date(createdOn),
      updatedOn: new Date(updatedOn),
      isAnimated: isAnimated === "TRUE",
      isOpaque: isOpaque === "TRUE",
      format: format as AcceptedSharpFormat,
    };
  }
}

const db = new Database();
export const data = new Data(db);
