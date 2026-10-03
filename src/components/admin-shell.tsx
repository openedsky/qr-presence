"use client";

import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  ChevronRight,
  FileText,
  History,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shield,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { BrandLockup, QrMark } from "./logo";
import { UserMenu } from "./user-menu";
import { OnboardingTour } from "./onboarding-tour";
import { tourSteps } from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import type { Permission } from "@/lib/rbac";
import { SIDEBAR_COOKIE } from "@/lib/ui-prefs";

type NavItem = { href: string; label: string; icon: LucideIcon; permission?: Permission; exact?: boolean };

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Pilotage",
    items: [
      { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
      { href: "/meetings", label: "Réunions", icon: CalendarDays },
      { href: "/calendar", label: "Calendrier", icon: CalendarRange },
      { href: "/statistics", label: "Statistiques", icon: BarChart3, permission: "stats.read" },
    ],
  },
  {
    section: "Administration",
    items: [
      { href: "/users", label: "Utilisateurs", icon: Users, permission: "users.manage" },
      { href: "/audit", label: "Journal d'audit", icon: Shield, permission: "audit.read" },
      { href: "/history", label: "Historique global", icon: History, permission: "history.global" },
      { href: "/documents", label: "Modèles PDF", icon: FileText, permission: "documents.manage" },
      { href: "/settings", label: "Paramètres", icon: Settings, permission: "settings.manage" },
    ],
  },
];

const ACCOUNT_PAGES: { href: string; label: string }[] = [
  { href: "/profile/password", label: "Mot de passe" },
  { href: "/profile/history", label: "Mon historique" },
  { href: "/profile", label: "Mon profil" },
];

function locate(pathname: string): { section: string; label: string; icon: LucideIcon } | null {
  for (const group of NAV) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        return { section: group.section, label: item.label, icon: item.icon };
      }
    }
  }
  const account = ACCOUNT_PAGES.find((page) => pathname === page.href || pathname.startsWith(`${page.href}/`));
  return account ? { section: "Mon compte", label: account.label, icon: UserRound } : null;
}

/** Point doré qui pulse sur le lien cliqué tant que la page n'est pas affichée (taille fixe : pas de décalage). */
function PendingHint({ mini }: { mini: boolean }) {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={cn("link-hint shrink-0", mini && "absolute right-1.5 top-1.5", pending && "is-pending")} />;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Menu mobile modal : focus piégé dans le panneau, Échap pour fermer, focus rendu au bouton d'ouverture. */
function MobileDrawer({
  children,
  onClose,
  returnFocus,
}: {
  children: React.ReactNode;
  onClose: () => void;
  returnFocus: RefObject<HTMLButtonElement | null>;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const opener = returnFocus.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!panel.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [returnFocus]);

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div aria-hidden className="drawer-backdrop absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navigation"
        className="drawer-panel absolute inset-y-0 left-0 w-72 shadow-2xl"
      >
        {children}
        <button
          aria-label="Fermer le menu"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-2 text-white hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

export function AdminShell({
  children,
  userName,
  role,
  email,
  permissions,
  initialCollapsed = false,
  showOnboarding = false,
}: {
  children: React.ReactNode;
  userName: string;
  role: string;
  email?: string | null;
  permissions: Permission[];
  initialCollapsed?: boolean;
  showOnboarding?: boolean;
}) {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const menuButton = useRef<HTMLButtonElement>(null);
  const open = openPath === pathname;
  const setOpen = (value: boolean) => setOpenPath(value ? pathname : null);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  const current = locate(pathname);
  const steps = useMemo(() => tourSteps(permissions), [permissions]);
  const CurrentIcon = current?.icon;

  const groups = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || permissions.includes(item.permission)),
  })).filter((group) => group.items.length > 0);

  const renderSidebar = (mini: boolean) => (
    <div className={cn("sidebar-surface flex h-full flex-col py-6 text-white", mini ? "px-3" : "px-4")}>
      <div className={cn("flex items-center", mini ? "justify-center" : "justify-between gap-2 px-2")}>
        {mini ? (
          <Link href="/dashboard" title="SODEFOR Présences">
            <QrMark className="h-11 w-11 drop-shadow-md" />
          </Link>
        ) : (
          <BrandLockup inverted />
        )}
      </div>
      <nav aria-label="Navigation principale" className={cn("mt-8 flex flex-1 flex-col overflow-y-auto overflow-x-hidden", mini ? "gap-3" : "gap-6")}>
        {groups.map((group, index) => (
          <div key={group.section}>
            {mini ? (
              index > 0 ? <div className="mx-auto mb-3 h-px w-8 bg-white/15" /> : null
            ) : (
              <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/65">{group.section}</p>
            )}
            <div className={cn("flex flex-col gap-1", !mini && "mt-2")}>
              {group.items.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-tour={item.href}
                    title={mini ? item.label : undefined}
                    aria-label={mini ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center rounded-xl text-sm font-medium transition",
                      mini ? "h-11 justify-center" : "gap-3 px-3 py-2.5",
                      active
                        ? "bg-white/15 text-white shadow-inner shadow-black/10"
                        : "text-white/75 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    {active ? <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-gold" /> : null}
                    <Icon
                      className={cn(
                        "transition-transform duration-200 group-hover:scale-110",
                        mini ? "h-5 w-5" : "h-4 w-4",
                        active ? "text-gold" : "text-white/60 group-hover:text-white",
                      )}
                    />
                    {mini ? null : <span className="flex-1">{item.label}</span>}
                    <PendingHint mini={mini} />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      {mini ? null : (
        <p className="mt-4 px-3 text-[10px] leading-relaxed text-white/70">
          SODEFOR Présences · émargement sécurisé par QR code
        </p>
      )}
    </div>
  );

  return (
    <div className="bg-app-pattern min-h-screen">
      <a
        href="#contenu"
        className="no-print sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-paper focus:px-4 focus:py-2 focus:font-semibold focus:text-forest focus:shadow-lg"
      >
        Aller au contenu
      </a>
      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-30 hidden transition-[width] duration-200 lg:block",
          collapsed ? "w-20" : "w-72",
        )}
      >
        {renderSidebar(collapsed)}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Déployer le menu" : "Réduire le menu"}
          aria-label={collapsed ? "Déployer le menu" : "Réduire le menu"}
          aria-expanded={!collapsed}
          className="absolute -right-3.5 top-9 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-paper text-forest shadow-md transition hover:bg-mint"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </aside>

      {open ? (
        <MobileDrawer onClose={() => setOpen(false)} returnFocus={menuButton}>
          {renderSidebar(false)}
        </MobileDrawer>
      ) : null}

      <div className={cn("transition-[padding] duration-200 print:pl-0", collapsed ? "lg:pl-20" : "lg:pl-72")}>
        <header className="no-print sticky top-0 z-20 border-b border-line/70 bg-sand/80 backdrop-blur-md">
          <div
            className={cn(
              "mx-auto flex h-16 items-center justify-between gap-4 px-4 sm:px-8",
              collapsed ? "max-w-[1680px]" : "max-w-[1400px]",
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <button
                ref={menuButton}
                aria-label="Ouvrir le menu"
                aria-expanded={open}
                aria-haspopup="dialog"
                onClick={() => setOpen(true)}
                className="rounded-xl border border-line bg-paper p-2 text-forest lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="lg:hidden">
                <BrandLockup compact />
              </div>
              {current && CurrentIcon ? (
                <nav aria-label="Fil d'Ariane" data-tour="breadcrumb" className="hidden min-w-0 items-center gap-2 text-sm lg:flex">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-mint text-forest">
                    <CurrentIcon className="h-4 w-4" />
                  </span>
                  <span className="text-muted">{current.section}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted/60" />
                  <span className="truncate font-semibold text-ink">{current.label}</span>
                </nav>
              ) : null}
            </div>
            <UserMenu userName={userName} role={role} email={email} />
          </div>
        </header>
        <main
          id="contenu"
          tabIndex={-1}
          className={cn("mx-auto px-4 py-8 outline-none sm:px-8", collapsed ? "max-w-[1680px]" : "max-w-[1400px]")}
        >
          {children}
        </main>
      </div>
      <OnboardingTour steps={steps} autoStart={showOnboarding} />
    </div>
  );
}
