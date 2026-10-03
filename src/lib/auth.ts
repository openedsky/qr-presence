import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { loginSchema } from "./validators";
import { prisma } from "./prisma";
import { authConfig } from "./auth.config";
import { writeAudit } from "./audit";
import { clientIp, rateLimit } from "./rate-limit";
import { logger } from "./logger";
import { cacheGet } from "./redis";

type FreshUser = {
  active: boolean;
  role: Role;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  organization: string | null;
  sessionVersion: number;
  mustChangePassword: boolean;
};

// Le JWT vit 12 h : l'état du compte est relu en base au plus toutes les 60 s,
// pour qu'une désactivation, un changement de rôle ou de mot de passe prenne effet sans attendre l'expiration.
const USER_TTL_MS = 60_000;
const STALE_USER_MAX_MS = 10 * 60_000;
const userCache = new Map<string, { value: FreshUser | null; at: number }>();

async function freshUser(id: string) {
  const hit = userCache.get(id);
  if (hit && Date.now() - hit.at < USER_TTL_MS) return hit.value;
  const value = await prisma.user.findUnique({
    where: { id },
    select: {
      active: true,
      role: true,
      firstName: true,
      lastName: true,
      jobTitle: true,
      organization: true,
      sessionVersion: true,
      mustChangePassword: true,
    },
  });
  userCache.set(id, { value, at: Date.now() });
  return value;
}

export function invalidateUserCache(id: string) {
  userCache.delete(id);
}

/**
 * Les essais en rafale sont freinés par couple (email, IP) : 5 échecs bloquent cette adresse pour ce compte
 * pendant 15 min, sans gêner le titulaire ailleurs. Le verrou du compte lui-même ne protège que contre une
 * attaque distribuée : 20 échecs → 15 min, puis 1 h tous les 20 échecs, série remise à zéro après 24 h.
 */
export const LOCK_STEPS = [
  { failures: 40, minutes: 60 },
  { failures: 20, minutes: 15 },
];
export const FAILURE_WINDOW_MS = 24 * 3600_000;
export const TEMP_PASSWORD_DAYS = 7;
const PAIR_FAILURES = 5;

export function lockDuration(failures: number) {
  const first = LOCK_STEPS[LOCK_STEPS.length - 1].failures;
  if (failures < first || failures % first !== 0) return 0;
  return LOCK_STEPS.find((step) => failures >= step.failures)?.minutes ?? 0;
}

/** Nombre d'échecs de la série en cours, celui-ci compris (série remise à zéro après 24 h sans échec). */
export function nextFailureCount(previous: number, lastFailedAt: Date | null, now = new Date()) {
  if (!lastFailedAt || now.getTime() - lastFailedAt.getTime() > FAILURE_WINDOW_MS) return 1;
  return previous + 1;
}

export function temporaryPasswordExpired(
  user: { mustChangePassword: boolean; passwordChangedAt: Date | null },
  now = new Date(),
) {
  if (!user.mustChangePassword || !user.passwordChangedAt) return false;
  return now.getTime() - user.passwordChangedAt.getTime() > TEMP_PASSWORD_DAYS * 24 * 3600_000;
}

/** Empreinte bcrypt d'une valeur aléatoire : un email inconnu coûte le même temps qu'un compte existant. */
const DUMMY_HASH = "$2b$12$O7/LlLu.n3Kbwl/LbZfxm.SvsIlAZoeIKRETP31AZjT9ud8lqt0yK";

class LockedError extends CredentialsSignin {
  code = "locked";
}

class RateLimitedError extends CredentialsSignin {
  code = "rate_limited";
}

class NoBackofficeError extends CredentialsSignin {
  code = "no_access";
}

class TemporaryPasswordExpiredError extends CredentialsSignin {
  code = "temp_expired";
}

async function auditLogin(action: "auth.login" | "auth.login_failed" | "auth.locked", userId: string | null, email?: string) {
  try {
    await writeAudit({
      actorId: action === "auth.login" ? userId : null,
      action,
      entity: "User",
      entityId: userId ?? "inconnu",
      afterData: email ? { email_attempted: email.toLowerCase() } : undefined,
    });
  } catch (error) {
    logger.error("auth.audit_failed", error);
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt(params) {
      const token = authConfig.callbacks.jwt(params);
      if (params.user || !token.id) return token;
      let user: FreshUser | null;
      try {
        user = await freshUser(String(token.id));
      } catch (error) {
        // Base momentanément injoignable : le dernier état connu du compte reste valable quelques minutes,
        // au-delà la session est refusée (un compte désactivé ne doit pas rester actif pendant une panne).
        logger.warn("auth.session_refresh_failed", { error: String(error) });
        const stale = userCache.get(String(token.id));
        if (!stale || Date.now() - stale.at > STALE_USER_MAX_MS) return null;
        user = stale.value;
      }
      if (!user || !user.active) return null;
      if ((token.sessionVersion ?? 0) !== user.sessionVersion) return null;
      token.role = user.role;
      token.firstName = user.firstName;
      token.lastName = user.lastName;
      token.jobTitle = user.jobTitle;
      token.organization = user.organization;
      token.mustChangePassword = user.mustChangePassword;
      return token;
    },
  },
  providers: [
    Credentials({
      name: "Identifiants SODEFOR",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();
        const ip = request instanceof Request ? clientIp(request) : "unknown";

        // Seuls les échecs sont décomptés par couple (email, IP) : le titulaire n'est pas bloqué par ses propres succès.
        const pairKey = `login:fail:${email}:${ip}`;
        const [byIp, pairFailures] = await Promise.all([rateLimit(`login:ip:${ip}`, 30, 15 * 60), cacheGet(`rl:${pairKey}`).then((value) => Number(value) || 0)]);
        if (!byIp.allowed || pairFailures >= PAIR_FAILURES) {
          if (byIp.count === 31) await auditLogin("auth.locked", null, email);
          throw new RateLimitedError();
        }
        const recordPairFailure = () => rateLimit(pairKey, PAIR_FAILURES, 15 * 60);

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.active) {
          await bcrypt.compare(parsed.data.password, DUMMY_HASH);
          await auditLogin("auth.login_failed", user?.id ?? null, email);
          // Même comportement qu'un compte existant : le message ne révèle pas quels emails existent.
          await recordPairFailure();
          const ghost = await rateLimit(`login:ghost:${email}`, LOCK_STEPS[LOCK_STEPS.length - 1].failures - 1, 15 * 60);
          if (!ghost.allowed) throw new LockedError();
          return null;
        }
        if (user.lockedUntil && user.lockedUntil > new Date()) throw new LockedError();

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) {
          const now = new Date();
          const failures = nextFailureCount(user.failedLoginCount, user.lastFailedLoginAt, now);
          const minutes = lockDuration(failures);
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginCount: failures,
              lastFailedLoginAt: now,
              ...(minutes > 0 ? { lockedUntil: new Date(now.getTime() + minutes * 60_000) } : {}),
            },
          });
          await auditLogin(minutes > 0 ? "auth.locked" : "auth.login_failed", user.id, email);
          await recordPairFailure();
          if (minutes > 0) throw new LockedError();
          return null;
        }
        // Rôle sans accès à l'administration : refus explicite plutôt qu'une boucle vers la connexion.
        if (user.role === "USER") throw new NoBackofficeError();
        if (temporaryPasswordExpired(user)) {
          await auditLogin("auth.login_failed", user.id, email);
          throw new TemporaryPasswordExpiredError();
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date(), failedLoginCount: 0, lastFailedLoginAt: null, lockedUntil: null },
        });
        invalidateUserCache(user.id);
        await auditLogin("auth.login", user.id);
        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          jobTitle: user.jobTitle,
          organization: user.organization,
          sessionVersion: user.sessionVersion,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
});
