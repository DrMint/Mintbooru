// @ts-check
import { defineConfig } from "astro/config";

import db from "@astrojs/db";

import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  integrations: [db()],

  adapter: node({
    mode: "standalone",
  }),
});
