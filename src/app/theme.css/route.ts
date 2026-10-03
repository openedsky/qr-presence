import { themeCss } from "@/server/services/theme";

export const dynamic = "force-dynamic";

/** Les pages intègrent déjà ces couleurs ; la feuille reste servie pour les clients qui la référencent encore. */
export async function GET() {
  return new Response(await themeCss(), {
    headers: { "Content-Type": "text/css; charset=utf-8", "Cache-Control": "public, max-age=60" },
  });
}
