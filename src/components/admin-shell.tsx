"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
  Users,
  BarChart3,
  CalendarDays,
} from "lucide-react";
import { BrandLockup } from "./logo";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";

const NAV = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/meetings", label: "Réunions", icon: CalendarDays },
  { href: "/statistics", label: "Statistiques", icon: BarChart3 },
  { href: "/users", label: "Utilisateurs", icon: Users },
  { href: "/audit", label: "Journal d'audit", icon: Shield },
  { href: "/documents", label: "Modèles PDF", icon: FileText },
  { href: "/settings", label: "Paramètres", icon: Settings },
];

export function AdminShell({
  children,
  userName,
  role,
}: {
  children: React.ReactNode;
  userName: string;
  role: string;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-sand">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-line bg-paper px-5 py-6 lg:flex lg:flex-col">
        <BrandLockup />
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                  active ? "bg-mint text-forest" : "text-muted hover:bg-sand hover:text-ink",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="rounded-2xl bg-mint p-4">
          <p className="text-sm font-semibold text-forest">{userName}</p>
          <p className="text-xs text-muted">{role}</p>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-forest"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-paper/90 px-4 py-3 backdrop-blur lg:hidden">
          <BrandLockup compact />
          <ClipboardList className="h-5 w-5 text-forest" />
        </header>
        <main className="px-4 py-6 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
