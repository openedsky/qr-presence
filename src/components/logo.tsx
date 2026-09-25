export function SodeforMark({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#14532d" />
      <path
        d="M32 12c8 8 11 14 11 22 0 8-4 14-11 18-7-4-11-10-11-18 0-8 3-14 11-22z"
        fill="#e7f3ea"
      />
      <path d="M32 22v26M24 36h16" stroke="#14532d" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <SodeforMark className={compact ? "h-9 w-9" : "h-12 w-12"} />
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-leaf">
          Ministère des Eaux et Forêts
        </p>
        <p className="font-display text-lg font-semibold leading-tight text-forest">SODEFOR Présences</p>
        {!compact ? (
          <p className="text-xs text-muted">Gestion intelligente des réunions</p>
        ) : null}
      </div>
    </div>
  );
}
