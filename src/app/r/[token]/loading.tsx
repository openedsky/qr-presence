import { Skeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div role="status" aria-label="Chargement" className="min-h-screen bg-[linear-gradient(180deg,#e7f3ea_0%,#f5f7f3_28%,#f5f7f3_100%)] px-4 py-8">
      <div className="mx-auto w-full max-w-md animate-[fade-in_0.2s_ease_0.1s_both]">
        <Skeleton className="h-10 w-44" />
        <Skeleton className="mt-8 h-8 w-3/4" />
        <Skeleton className="mt-3 h-4 w-1/2" />
        <div className="card mt-6 space-y-4 p-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
          ))}
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
        <span className="sr-only">Chargement du formulaire…</span>
      </div>
    </div>
  );
}
