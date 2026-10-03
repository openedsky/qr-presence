import Link from "next/link";
import { History, KeyRound, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "profile", href: "/profile", label: "Mon profil", icon: UserRound },
  { key: "password", href: "/profile/password", label: "Mot de passe", icon: KeyRound },
  { key: "history", href: "/profile/history", label: "Mon historique", icon: History },
] as const;

export function AccountTabs({ active }: { active: (typeof TABS)[number]["key"] }) {
  return (
    <nav className="mb-6 flex flex-wrap gap-2">
      {TABS.map(({ key, href, label, icon: Icon }) => (
        <Link
          key={key}
          href={href}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
            active === key ? "bg-primary text-white shadow-sm" : "border border-line bg-paper text-ink hover:bg-mint",
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
