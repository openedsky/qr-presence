"use client";

import { FormEvent, Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CalendarRange,
  Eye,
  EyeOff,
  FileCheck2,
  Lock,
  Mail,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { BrandLockup, QrMark } from "@/components/logo";
import { Button, Field, Input } from "@/components/ui";
import { setFlash } from "@/lib/alerts";

const HIGHLIGHTS = [
  { icon: QrCode, title: "QR statique ou dynamique", text: "Affiche imprimable ou code renouvelé à l'écran, anti-fraude." },
  { icon: ShieldCheck, title: "Émargement contrôlé", text: "Signature, détection des doublons et journal d'audit." },
  { icon: FileCheck2, title: "Listes officielles", text: "PDF versionnés et vérifiables, exports Excel et CSV." },
  { icon: CalendarRange, title: "Pilotage", text: "Calendrier, suivi en temps réel et statistiques." },
];

const LOGIN_ERRORS: Record<string, string> = {
  locked:
    "Compte temporairement verrouillé après plusieurs échecs. Réessayez plus tard ou contactez un administrateur.",
  rate_limited: "Trop de tentatives de connexion. Patientez quelques minutes avant de réessayer.",
  no_access: "Ce compte n'a pas accès à l'espace d'administration. Contactez un administrateur.",
  temp_expired:
    "Mot de passe provisoire expiré (validité 7 jours). Demandez à un administrateur de réinitialiser votre mot de passe.",
  default: "Identifiants invalides ou compte désactivé.",
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginScreen />
    </Suspense>
  );
}

function LoginScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    let result: Awaited<ReturnType<typeof signIn>>;
    try {
      result = await signIn("credentials", {
        email: String(form.get("email") || ""),
        password: String(form.get("password") || ""),
        redirect: false,
      });
    } catch {
      setPending(false);
      setError("Serveur injoignable. Vérifiez votre connexion puis réessayez.");
      return;
    }
    if (result?.error) {
      setPending(false);
      setError(LOGIN_ERRORS[result.code ?? ""] ?? LOGIN_ERRORS.default);
      return;
    }
    setFlash({ icon: "success", title: "Bienvenue sur SODEFOR Présences" });
    router.push("/dashboard");
    router.refresh();
  }

  const notice = params.has("motdepasse")
    ? "Mot de passe modifié : reconnectez-vous avec votre nouveau mot de passe."
    : null;

  return (
    <div className="grid h-dvh overflow-hidden lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-sidebar text-white lg:flex lg:flex-col lg:px-12 lg:py-10 xl:px-16 short:lg:py-7">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,rgba(255,255,255,0.1)_0%,transparent_50%,rgba(0,0,0,0.3)_100%)]" />
        <div className="bg-qr-grid pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-gold/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-leaf/25 blur-3xl" />

        <div className="relative">
          <BrandLockup inverted />
        </div>

        <div className="relative my-auto max-w-xl py-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-gold">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            Back-office
          </span>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.1] xl:text-5xl">
            L&apos;émargement des réunions, <span className="text-gold">simple et certifié.</span>
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-emerald-50/80">
            Créez vos réunions, affichez le QR code en salle et obtenez une liste de présence officielle,
            signée et vérifiable.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 short:hidden">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/15 text-gold">
                  <Icon className="h-4 w-4" />
                </span>
                <p className="mt-2.5 font-semibold">{title}</p>
                <p className="mt-1 text-sm leading-5 text-emerald-50/70">{text}</p>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-emerald-100/80">
          Société de Développement des Forêts · Ministère des Eaux et Forêts · République de Côte d&apos;Ivoire
        </p>
      </aside>

      <main className="bg-app-pattern flex min-h-0 flex-col">
        <div className="bg-qr-grid relative overflow-hidden bg-sidebar px-6 pb-12 pt-6 text-white lg:hidden short:pb-10 short:pt-4">
          <BrandLockup inverted />
          <p className="mt-4 font-display text-xl font-semibold leading-snug short:hidden">
            L&apos;émargement des réunions, <span className="text-gold">simple et certifié.</span>
          </p>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-4 lg:py-6">
          <div className="-mt-8 w-full max-w-md lg:mt-0">
            <form onSubmit={onSubmit} className="card p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <QrMark className="h-11 w-11 shrink-0" />
                <div>
                  <h2 className="font-display text-3xl font-semibold leading-none text-forest-deep">Connexion</h2>
                  <p className="mt-1.5 text-sm text-muted">Réservé aux agents habilités.</p>
                </div>
              </div>

              {notice && !error ? (
                <div
                  role="status"
                  className="mt-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800"
                >
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  {notice}
                </div>
              ) : null}

              {error ? (
                <div
                  role="alert"
                  className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              ) : null}

              <div className="mt-5 grid gap-4">
                <Field label="Email professionnel" required htmlFor="email">
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      autoFocus
                      placeholder="prenom.nom@sodefor.ci"
                      className="pl-10!"
                      onChange={() => setError(null)}
                    />
                  </div>
                </Field>
                <Field label="Mot de passe" required htmlFor="password">
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="px-10!"
                      onChange={() => setError(null)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition hover:bg-mint hover:text-forest"
                      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
              </div>

              <div className="mt-3 flex justify-end">
                <Link href="/forgot-password" className="text-sm font-semibold text-forest hover:underline">
                  Mot de passe oublié ?
                </Link>
              </div>

              <Button type="submit" className="group mt-5 w-full py-3 text-base" disabled={pending}>
                {pending ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Vérification…
                  </>
                ) : (
                  <>
                    Se connecter
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </>
                )}
              </Button>

              <div className="mt-5 flex items-center gap-2 border-t border-line pt-4 text-xs text-muted short:hidden">
                <ShieldCheck className="h-4 w-4 shrink-0 text-leaf" />
                Connexion sécurisée · session limitée à 12 h · accès tracés dans le journal d&apos;audit.
              </div>
            </form>

            <p className="mt-4 text-center text-xs text-muted short:hidden">
              Participant à une réunion ? Scannez simplement le QR code affiché en salle.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
