import { PageHeaderSkeleton, Skeleton, StatCardsSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div role="status" aria-label="Chargement de la réunion" className="animate-[fade-in_0.2s_ease_0.1s_both]">
      <Skeleton className="mb-5 h-4 w-40" />
      <PageHeaderSkeleton />
      <StatCardsSkeleton />
      <div className="mt-6 flex gap-2 border-b border-line pb-3">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-8 w-28 rounded-lg" />
        ))}
      </div>
      <div className="mt-5">
        <TableSkeleton rows={5} />
      </div>
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
