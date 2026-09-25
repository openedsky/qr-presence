import { BrandLockup } from "@/components/logo";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; name?: string; org?: string; time?: string }>;
}) {
  const { code, name, org, time } = await searchParams;
  const formatted = time ? new Date(time).toLocaleTimeString("fr-FR") : "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand px-4">
      <div className="w-full max-w-md text-center">
        <BrandLockup />
        <div className="card mt-8 p-8">
          <p className="text-4xl">✅</p>
          <h1 className="mt-3 font-display text-3xl text-forest-deep">Présence enregistrée</h1>
          <p className="mt-4 text-xl font-semibold">{name}</p>
          <p className="text-muted">{org}</p>
          <p className="mt-4 text-sm">Enregistrement effectué à {formatted}</p>
          <p className="mt-2 text-xs uppercase tracking-wide text-muted">Confirmation {code}</p>
        </div>
      </div>
    </div>
  );
}
