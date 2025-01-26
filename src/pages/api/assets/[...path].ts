import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ params }) => {
  const file = Bun.file(`./data/assets/${params.path}`);
  if (!(await file.exists())) {
    return new Response(null, { status: 404 });
  }
  return new Response(file);
};
