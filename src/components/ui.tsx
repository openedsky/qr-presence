import Link from "next/link";
import { Loader2 } from "lucide-react";
import { AnimatedNumber } from "./animated-number";
import { cn } from "@/lib/utils";
import { Children, cloneElement, isValidElement } from "react";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card p-5", className)} {...props} />;
}

type Variant = "primary" | "ghost" | "danger" | "outline" | "gold";

const VARIANTS: Record<Variant, string> = {
  primary: "btn-primary",
  ghost: "rounded-xl text-forest hover:bg-mint",
  danger: "rounded-xl bg-danger text-white shadow-sm shadow-red-900/10 hover:brightness-110",
  outline: "rounded-xl border border-line bg-paper text-ink hover:border-leaf/50 hover:bg-mint",
  gold: "rounded-xl bg-[#8a5a12] text-white shadow-sm shadow-amber-900/20 hover:brightness-110",
};

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 aria-hidden className={cn("h-4 w-4 shrink-0 animate-spin", className)} />;
}

export function Button({
  className,
  variant = "primary",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      className={cn(
        BUTTON_BASE,
        VARIANTS[variant],
        loading && "cursor-progress [&>svg:not(.animate-spin)]:hidden",
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function LinkButton({
  className,
  variant = "primary",
  href,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; href: string }) {
  const classes = cn(BUTTON_BASE, VARIANTS[variant], className);
  if (href.startsWith("/api/") || props.download !== undefined) {
    return <a href={href} className={classes} {...props} />;
  }
  return <Link href={href} className={classes} {...props} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("field", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("field min-h-28", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("field", className)} {...props} />;
}

export function RequiredMark() {
  return (
    <span className="ml-0.5 font-bold text-red-600" aria-hidden="true">
      *
    </span>
  );
}

export function Label({
  children,
  required,
  htmlFor,
  className,
}: {
  children: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label className={cn("label", className)} htmlFor={htmlFor}>
      {children}
      {required ? <RequiredMark /> : null}
      {required ? <span className="sr-only"> (obligatoire)</span> : null}
    </label>
  );
}

export function Field({
  label,
  required,
  hint,
  error,
  htmlFor,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string | null;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const hintId = hint && htmlFor ? `${htmlFor}-hint` : undefined;
  const errorId = error && htmlFor ? `${htmlFor}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  // Aide et erreur annoncées par les lecteurs d'écran : reliées au champ direct portant l'id ciblé.
  const control =
    htmlFor && (describedBy || error)
      ? Children.map(children, (child) => {
          if (!isValidElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean }>(child)) return child;
          if (child.props.id !== htmlFor) return child;
          return cloneElement(child, {
            "aria-describedby": [child.props["aria-describedby"], describedBy].filter(Boolean).join(" "),
            "aria-invalid": error ? true : child.props["aria-invalid"],
          });
        })
      : children;
  return (
    <div className={className}>
      <Label required={required} htmlFor={htmlFor}>
        {label}
      </Label>
      {control}
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-semibold text-danger">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function RequiredLegend({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted", className)}>
      Les champs marqués d&apos;un astérisque <RequiredMark /> sont obligatoires.
    </p>
  );
}

export function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      {icon ? (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mint text-forest">{icon}</span>
      ) : null}
      <div>
        <h2 className="font-display text-lg font-semibold text-forest-deep">{title}</h2>
        {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
      </div>
    </div>
  );
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", className)}>
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon,
  tone = "forest",
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "forest" | "gold" | "sky" | "rose";
  hint?: string;
}) {
  const tones = {
    forest: "bg-mint text-forest",
    gold: "bg-amber-50 text-amber-700",
    sky: "bg-sky-50 text-sky-700",
    rose: "bg-rose-50 text-rose-700",
  } as const;
  return (
    <div className="card card-hover group relative overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
          <p className="mt-3 font-display text-4xl font-semibold text-forest-deep">
            {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
          </p>
          {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
        </div>
        {icon ? (
          <span
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110",
              tones[tone],
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow = "SODEFOR Présences",
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-leaf">{eyebrow}</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-forest-deep">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  );
}
