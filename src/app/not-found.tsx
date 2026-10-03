import Link from "next/link";
import { BrandLockup } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sand px-4">
      <div className="max-w-md text-center">
        <BrandLockup />
        <h1 className="mt-8 font-display text-4xl text-forest-deep">Page introuvable</h1>
        <p className="mt-3 text-muted">Le lien demandé n&apos;existe pas ou n&apos;est plus actif.</p>
        <p className="mt-4 rounded-2xl bg-mint px-4 py-3 text-sm text-forest-deep">
          Vous venez d&apos;un QR code de réunion ? Scannez de nouveau le QR affiché en salle, ou demandez le lien à
          l&apos;organisateur : l&apos;ancien lien a pu être renouvelé.
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-forest hover:underline">
          Agent SODEFOR : accéder au back-office
        </Link>
      </div>
    </div>
  );
}
