import { column, defineDb, defineTable } from "astro:db";

const Posts = defineTable({
  columns: {
    id: column.number({ primaryKey: true }),
    name: column.text({ optional: false }),
    extension: column.text({ optional: false }),
  },
});

// https://astro.build/db/config
export default defineDb({
  tables: { Posts },
});
