import { BadgeCheck, CalendarClock, Mail, ShieldCheck } from "lucide-react";
import { requireSession } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/rbac";
import { Card, PageHeader } from "@/components/ui";
import { auditDateTime } from "@/components/audit-views";
import { AccountTabs } from "./account-tabs";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Mon profil" };

export default async function ProfilePage() {
  const session = await requireSession();
  const [user, actions] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id } }),
    prisma.auditLog.count({ where: { actorId: session.user.id } }),
  ]);

  const facts = [
    { icon: Mail, label: "Email de connexion", value: user.email },
    { icon: ShieldCheck, label: "Rôle", value: ROLE_LABELS[user.role] },
    { icon: CalendarClock, label: "Dernière connexion", value: user.lastLoginAt ? auditDateTime(user.lastLoginAt) : "—" },
    { icon: BadgeCheck, label: "Compte créé le", value: auditDateTime(user.createdAt) },
  ];

  return (
    <div>
      <PageHeader eyebrow="Mon compte" title="Mon profil" subtitle="Vos informations personnelles, affichées sur les documents que vous générez." />
      <AccountTabs active="profile" />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card className="p-6">
          <ProfileForm
            initial={{
              firstName: user.firstName,
              lastName: user.lastName,
              jobTitle: user.jobTitle ?? "",
              organization: user.organization ?? "",
              phone: user.phone ?? "",
            }}
          />
        </Card>
        <Card className="h-fit p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-white">
              {`${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-xl font-semibold text-forest-deep">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-sm text-muted">{user.jobTitle || "Fonction non renseignée"}</p>
            </div>
          </div>
          <dl className="mt-6 space-y-4 text-sm">
            {facts.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-leaf" />
                <div className="min-w-0">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
                  <dd className="truncate font-medium text-ink">{value}</dd>
                </div>
              </div>
            ))}
          </dl>
          <p className="mt-6 rounded-xl bg-mint px-3 py-2 text-xs text-forest">
            {actions} action(s) enregistrée(s) dans votre historique. L&apos;email et le rôle ne peuvent être modifiés que par un administrateur.
          </p>
        </Card>
      </div>
    </div>
  );
}
