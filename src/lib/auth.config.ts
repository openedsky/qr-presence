import type { NextAuthConfig } from "next-auth";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Chemins encore accessibles tant qu'un mot de passe provisoire n'a pas été remplacé. */
function allowedWhilePasswordChangePending(pathname: string) {
  return (
    pathname === "/profile/password" ||
    pathname.startsWith("/api/profile/password") ||
    pathname.startsWith("/api/auth")
  );
}

/**
 * Protection CSRF en complément du cookie SameSite : une requête d'API venue d'un autre site est refusée,
 * et toute écriture doit provenir de l'origine de l'application.
 */
function crossSiteRejection(request: Request, pathname: string) {
  if (!pathname.startsWith("/api/") || pathname.startsWith("/api/health")) return null;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    return Response.json({ error: "Requête inter-sites refusée" }, { status: 403 });
  }
  if (SAFE_METHODS.has(request.method) || pathname.startsWith("/api/auth")) return null;
  const origin = request.headers.get("origin");
  const expected = new URL(request.url).origin;
  const allowed = [expected, process.env.APP_URL, process.env.AUTH_URL]
    .filter(Boolean)
    .map((value) => new URL(String(value)).origin);
  if (origin && !allowed.includes(origin)) {
    return Response.json({ error: "Origine de la requête refusée" }, { status: 403 });
  }
  if (!origin && fetchSite !== "same-origin") {
    return Response.json({ error: "Origine de la requête absente" }, { status: 403 });
  }
  const type = request.headers.get("content-type") ?? "";
  const hasBody = request.headers.get("content-length") !== "0" && request.method !== "DELETE";
  if (hasBody && type && !type.includes("application/json")) {
    return Response.json({ error: "Format de requête non pris en charge" }, { status: 415 });
  }
  return null;
}

export const authConfig = {
  trustHost: process.env.AUTH_TRUST_HOST === "true" || process.env.NODE_ENV !== "production",
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 12,
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const rejected = crossSiteRejection(request, pathname);
      if (rejected) return rejected;
      const publicPath =
        pathname === "/" ||
        pathname.startsWith("/login") ||
        pathname.startsWith("/forgot-password") ||
        pathname.startsWith("/r/") ||
        pathname.startsWith("/verify/") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/public") ||
        pathname.startsWith("/api/health") ||
        pathname.startsWith("/manifest.json") ||
        pathname === "/theme.css" ||
        pathname.startsWith("/brand/") ||
        pathname.startsWith("/icon.svg") ||
        pathname.startsWith("/sw.js");
      if (publicPath) return true;
      if (!auth?.user) {
        if (pathname.startsWith("/api/")) {
          return Response.json({ error: "Non authentifié" }, { status: 401 });
        }
        // Redirection explicite : avec un gestionnaire dans le proxy, un simple `false` le laisserait s'exécuter.
        const login = new URL("/login", request.nextUrl);
        login.searchParams.set("callbackUrl", request.nextUrl.href);
        return Response.redirect(login);
      }
      if (auth.user.mustChangePassword && !allowedWhilePasswordChangePending(pathname)) {
        if (pathname.startsWith("/api/")) {
          return Response.json({ error: "Changez d'abord votre mot de passe provisoire." }, { status: 403 });
        }
        return Response.redirect(new URL("/profile/password?provisoire=1", request.nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.jobTitle = user.jobTitle;
        token.organization = user.organization;
        token.sessionVersion = user.sessionVersion ?? 0;
        token.mustChangePassword = user.mustChangePassword ?? false;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? "");
        session.user.role = token.role ?? "USER";
        session.user.firstName = String(token.firstName ?? "");
        session.user.lastName = String(token.lastName ?? "");
        session.user.jobTitle = token.jobTitle ?? null;
        session.user.organization = token.organization ?? null;
        session.user.mustChangePassword = token.mustChangePassword ?? false;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
