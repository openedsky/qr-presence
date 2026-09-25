"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { BrandLockup } from "@/components/logo";
import { Button, Input } from "@/components/ui";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
      redirect: false,
    });
    setPending(false);
    if (result?.error) {
      setError("Identifiants invalides ou compte inactif.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#e7f3ea,_#f5f7f3_50%)] px-4">
      <div className="w-full max-w-md">
        <BrandLockup />
        <form onSubmit={onSubmit} className="card mt-8 p-6">
          <h1 className="font-display text-2xl text-forest-deep">Connexion</h1>
          <p className="mt-1 text-sm text-muted">Back-office réservé aux agents habilités.</p>
          <label className="label mt-6" htmlFor="email">Email</label>
          <Input id="email" name="email" type="email" required autoComplete="email" placeholder="a.seri@sodefor.ci" />
          <label className="label mt-4" htmlFor="password">Mot de passe</label>
          <Input id="password" name="password" type="password" required autoComplete="current-password" />
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <Button className="mt-6 w-full" disabled={pending}>
            {pending ? "Vérification…" : "Se connecter"}
          </Button>
          <p className="mt-4 text-center text-sm">
            <Link href="/forgot-password" className="text-forest underline">
              Mot de passe oublié
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
