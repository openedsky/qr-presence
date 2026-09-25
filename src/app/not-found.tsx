import Link from "next/link";
import { BrandLockup } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sand px-4">
      <div className="max-w-md text-center">
        <BrandLockup />
        <h1 className="mt-8 font-display text-4xl text-forest-deep">Page introuvable</h1>
        <p className="mt-3 text-muted">Le lien demandé n'existe pas ou n'est plus actif.</p>
        <Link href="/" className="mt-6 inline-block font-semibold text-forest">
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}
