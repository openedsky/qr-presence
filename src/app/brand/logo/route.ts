import { getLogo } from "@/server/services/branding";

/** Logo de l'organisation (public : affiché sur les pages d'émargement et les QR codes). */
export async function GET(request: Request) {
  const logo = await getLogo();
  if (!logo) return new Response("Logo introuvable", { status: 404 });
  const versioned = new URL(request.url).searchParams.get("v") === new URL(logo.url, request.url).searchParams.get("v");
  return new Response(new Uint8Array(logo.bytes), {
    headers: {
      "Content-Type": logo.mime,
      // URL versionnée par l'empreinte du contenu : immuable ; sinon courte durée (logo susceptible de changer).
      "Cache-Control": versioned ? "public, max-age=31536000, immutable" : "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
