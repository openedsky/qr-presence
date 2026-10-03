import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton", className)} />;
}

export function PageHeaderSkeleton({ actions = true }: { actions?: boolean }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      {actions ? <Skeleton className="h-10 w-40 rounded-xl" /> : null}
    </div>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="card p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-16" />
            </div>
            <Skeleton className="h-11 w-11 rounded-2xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="card overflow-hidden p-0">
      <div className="flex gap-6 bg-mint/60 px-4 py-3.5">
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={index} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-6 border-t border-line px-4 py-4">
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton key={column} className={cn("h-4 flex-1", column === 0 && "max-w-56")} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Squelette générique : en-tête, indicateurs, tableau. */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Chargement" className="animate-[fade-in_0.2s_ease_0.1s_both]">
      <PageHeaderSkeleton />
      <StatCardsSkeleton />
      <div className="mt-6">
        <TableSkeleton />
      </div>
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
