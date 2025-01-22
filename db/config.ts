import { column, defineDb, defineTable } from "astro:db";

const Posts = defineTable({
  columns: {
    id: column.number({ primaryKey: true }),
    filename: column.text({ unique: true }),
    format: column.text(),
    createdOn: column.date(),
    updatedOn: column.date(),
    isOpaque: column.boolean(),
    isAnimated: column.boolean(),
    name: column.text(),
    width: column.number(),
    height: column.number(),
    perceptualHash: column.text(),
  },
});

const DuplicateEntries = defineTable({
  columns: {
    id: column.number({ primaryKey: true }),
    group: column.text(),
    post: column.number({ references: () => Posts.columns.id }),
  },
});

// https://astro.build/db/config
export default defineDb({
  tables: { Posts, DuplicateEntries },
});
