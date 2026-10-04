"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, GraduationCap, History, KeyRound, LogOut, UserRound, type LucideIcon } from "lucide-react";
import { START_TOUR_EVENT } from "@/lib/onboarding";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { confirmAction } from "@/lib/alerts";

const ACCOUNT_LINKS: { href: string; label: string; hint: string; icon: LucideIcon }[] = [
  { href: "/profile", label: "Mon profil", hint: "Identité et coordonnées", icon: UserRound },
  { href: "/profile/password", label: "Mot de passe", hint: "Sécuriser mon accès", icon: KeyRound },
  { href: "/profile/history", label: "Mon historique", hint: "Mes actions et connexions", icon: History },
];

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function UserMenu({ userName, role, email }: { userName: string; role: string; email?: string | null }) {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenPath(null);
    };
    rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenPath(null);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const items = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
      if (items.length === 0) return;
      event.preventDefault();
      const current = items.indexOf(document.activeElement as HTMLElement);
      const step = event.key === "ArrowDown" ? 1 : -1;
      items[(current + step + items.length) % items.length].focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function replayTour() {
    setOpenPath(null);
    window.dispatchEvent(new Event(START_TOUR_EVENT));
  }

  async function logout() {
    setOpenPath(null);
    const ok = await confirmAction({
      title: "Se déconnecter ?",
      text: "Vous devrez saisir à nouveau vos identifiants pour accéder au back-office.",
      confirmText: "Me déconnecter",
    });
    if (ok) await signOut({ callbackUrl: "/login" });
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(event) => {
        // Tabulation hors du menu : il se referme. relatedTarget nul (clic sous Safari) : laissé au pointerdown.
        const next = event.relatedTarget as Node | null;
        if (open && next && !event.currentTarget.contains(next)) setOpenPath(null);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpenPath(open ? null : pathname)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menu de ${userName}`}
        data-tour="user-menu"
        className={cn(
          "group flex items-center gap-3 rounded-2xl border py-1.5 pl-1.5 pr-2 transition sm:pr-3",
          open
            ? "border-forest/20 bg-paper shadow-md shadow-forest/10"
            : "border-transparent hover:border-line hover:bg-paper hover:shadow-sm",
        )}
      >
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-[#e0b04a] to-gold text-sm font-bold text-forest-deep shadow-sm">
          {initials(userName)}
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-paper bg-emerald-500" />
        </span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-44 truncate text-sm font-semibold text-ink">{userName}</span>
          <span className="block max-w-44 truncate text-xs text-muted">{role}</span>
        </span>
        <ChevronDown className={cn("hidden h-4 w-4 text-muted transition-transform sm:block", open && "rotate-180")} />
      </button>

      <div
        role="menu"
        aria-hidden={!open}
        className={cn(
          "absolute right-0 top-full z-50 mt-2 w-72 origin-top-right overflow-hidden rounded-2xl border border-line bg-paper shadow-2xl shadow-forest/15 transition duration-150",
          open ? "visible scale-100 opacity-100" : "invisible scale-95 opacity-0",
        )}
      >
        <div className="sidebar-surface flex items-center gap-3 px-4 py-4 text-white">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold text-base font-bold text-forest-deep shadow-md shadow-black/20">
            {initials(userName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{userName}</p>
            {email ? <p className="truncate text-xs text-white/70">{email}</p> : null}
            <span className="mt-1 inline-flex rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/90">
              {role}
            </span>
          </div>
        </div>
        <div className="p-2">
          <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Mon compte</p>
          {ACCOUNT_LINKS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                tabIndex={open ? 0 : -1}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition",
                  active ? "bg-mint" : "hover:bg-sand",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg transition",
                    active ? "bg-forest text-white" : "bg-mint text-forest group-hover:bg-forest group-hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{item.label}</span>
                  <span className="block text-xs text-muted">{item.hint}</span>
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            role="menuitem"
            tabIndex={open ? 0 : -1}
            onClick={replayTour}
            className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-sand"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-mint text-forest transition group-hover:bg-forest group-hover:text-white">
              <GraduationCap className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">Revoir le didacticiel</span>
              <span className="block text-xs text-muted">Visite guidée de l&apos;application</span>
            </span>
          </button>
        </div>
        <div className="border-t border-line p-2">
          <button
            type="button"
            role="menuitem"
            tabIndex={open ? 0 : -1}
            onClick={logout}
            className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-red-50"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-danger transition group-hover:bg-danger group-hover:text-white">
              <LogOut className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold text-danger">Déconnexion</span>
          </button>
        </div>
      </div>
    </div>
  );
}
