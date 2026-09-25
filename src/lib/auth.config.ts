import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  trustHost: true,
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
        pathname.startsWith("/icon.svg") ||
        pathname.startsWith("/sw.js");
      if (publicPath) return true;
      if (auth?.user) return true;
      if (pathname.startsWith("/api/")) {
        return Response.json({ error: "Non authentifié" }, { status: 401 });
      }
      return false;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.firstName = (user as { firstName?: string }).firstName;
        token.lastName = (user as { lastName?: string }).lastName;
        token.jobTitle = (user as { jobTitle?: string | null }).jobTitle;
        token.organization = (user as { organization?: string | null }).organization;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? "");
        session.user.role = (token.role as never) ?? "USER";
        session.user.firstName = String(token.firstName ?? "");
        session.user.lastName = String(token.lastName ?? "");
        session.user.jobTitle = (token.jobTitle as string | null) ?? null;
        session.user.organization = (token.organization as string | null) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
