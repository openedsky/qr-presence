import Link from "next/link";
import { BrandLockup } from "@/components/logo";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e7f3ea,_#f5f7f3_42%)]">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
        <BrandLockup />
        <div className="my-auto grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-leaf">
              Société de Développement des Forêts
            </p>
            <h1 className="mt-3 font-display text-5xl leading-tight text-forest-deep">
              Présences officielles, émargement mobile, documents authentifiés.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Application institutionnelle de gestion des réunions SODEFOR : QR sécurisé,
              signature manuscrite, contrôle des doublons, listes officielles et traçabilité.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="btn-primary px-5 py-3 text-sm">
                Accéder au back-office
              </Link>
              <a href="#fonctionnement" className="rounded-xl border border-line px-5 py-3 text-sm font-semibold">
                Voir le parcours
              </a>
            </div>
          </div>
          <div className="card p-6">
            <p className="text-sm font-semibold text-forest">Parcours cible</p>
            <ol id="fonctionnement" className="mt-4 space-y-3 text-sm text-muted">
              {[
                "Création de la réunion",
                "Ouverture des inscriptions",
                "Génération et affichage du QR",
                "Scan, identification, signature",
                "Suivi temps réel",
                "Clôture et liste définitive",
              ].map((item, index) => (
                <li key={item} className="flex gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-mint text-xs font-bold text-forest">
                    {index + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
