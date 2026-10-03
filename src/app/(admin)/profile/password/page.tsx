import { KeyRound } from "lucide-react";
import { requireSession } from "@/lib/guards";
import { Card, PageHeader } from "@/components/ui";
import { AccountTabs } from "../account-tabs";
import { PasswordForm } from "./password-form";

export const metadata = { title: "Changer mon mot de passe" };

export default async function PasswordPage() {
  const session = await requireSession();
  const provisional = Boolean(session.user.mustChangePassword);
  return (
    <div>
      <PageHeader eyebrow="Mon compte" title="Changer mon mot de passe" subtitle="Choisissez un mot de passe robuste que vous n'utilisez sur aucun autre service." />
      {provisional ? (
        <div role="alert" className="mb-6 flex max-w-2xl items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <KeyRound className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            <strong>Mot de passe provisoire.</strong> Il vous a été attribué par un administrateur : choisissez votre
            propre mot de passe pour accéder à l&apos;application.
          </p>
        </div>
      ) : (
        <AccountTabs active="password" />
      )}
      <Card className="max-w-2xl p-6">
        <PasswordForm />
      </Card>
    </div>
  );
}
