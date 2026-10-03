import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { contentSecurityPolicy } from "@/lib/csp";

const { auth } = NextAuth(authConfig);

/** Exécuté seulement si l'accès est autorisé (sinon le callback `authorized` a déjà répondu). */
export default auth((request) => {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce);
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
});

export const config = {
  // Fichiers statiques publics : ni session à décoder ni CSP à calculer.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.json|sw.js|brand/).*)"],
};
