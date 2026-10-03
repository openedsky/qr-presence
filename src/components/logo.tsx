const FINDERS = [
  [8, 8],
  [40, 8],
  [8, 40],
] as const;

const MODULES = [
  [28, 8], [32, 14], [28, 20], [34, 22],
  [8, 28], [14, 32], [20, 28], [22, 34],
  [28, 28], [34, 30], [30, 36], [40, 28],
  [46, 32], [52, 28], [28, 44], [34, 50],
  [28, 52], [40, 38], [52, 38],
] as const;

export function QrMark({ className = "h-12 w-12", title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <rect width="64" height="64" rx="14" fill="#14532d" />
      <path d="M14 0h36a14 14 0 0 1 14 14v4C44 26 22 22 0 34V14A14 14 0 0 1 14 0z" fill="#ffffff" opacity="0.07" />
      {FINDERS.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="16" height="16" rx="4" fill="#ffffff" />
          <rect x={x + 3} y={y + 3} width="10" height="10" rx="2.5" fill="#14532d" />
          <rect x={x + 5} y={y + 5} width="6" height="6" rx="1.5" fill="#ffffff" />
        </g>
      ))}
      {MODULES.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="4.5" height="4.5" rx="1.2" fill="#ffffff" opacity="0.92" />
      ))}
      <rect x="42" y="44" width="14" height="12" rx="3" fill="#f2c14e" />
      <path d="M45.5 50.2l2.6 2.6 4.6-5" stroke="#0b3d24" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BrandLockup({ compact = false, inverted = false }: { compact?: boolean; inverted?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <QrMark className={compact ? "h-10 w-10 shrink-0 drop-shadow-sm" : "h-12 w-12 shrink-0 drop-shadow-md"} title="SODEFOR Présences" />
      <div className="min-w-0">
        <p
          className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${inverted ? "text-emerald-200/80" : "text-leaf"}`}
        >
          Ministère des Eaux et Forêts
        </p>
        <p className={`font-display text-lg font-semibold leading-tight ${inverted ? "text-white" : "text-forest"}`}>
          SODEFOR Présences
        </p>
        {!compact ? (
          <p className={`text-xs ${inverted ? "text-emerald-100/70" : "text-muted"}`}>Émargement par QR code</p>
        ) : null}
      </div>
    </div>
  );
}
