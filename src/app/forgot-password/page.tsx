import Link from "next/link";
import { BrandLockup } from "@/components/logo";
import { Card } from "@/components/ui";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sand px-4">
      <div className="w-full max-w-md">
        <BrandLockup />
        <Card className="mt-8">
          <h1 className="font-display text-2xl text-forest-deep">Mot de passe oublié</h1>
          <p className="mt-2 text-sm text-muted">
            Pour des raisons de sécurité, la réinitialisation est effectuée par un super
            administrateur. Contactez la DSI SODEFOR.
          </p>
          <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-forest">
            Retour à la connexion
          </Link>
        </Card>
      </div>
    </div>
  );
}
