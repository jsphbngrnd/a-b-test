import type { APIRoute } from "astro";

export const GET: APIRoute = ({ cookies, redirect }) => {
  cookies.delete("sl_vid", { path: "/" });
  cookies.delete("sl_asg", { path: "/" });
  cookies.delete("sl_preview", { path: "/" });
  return redirect("/", 302);
};
