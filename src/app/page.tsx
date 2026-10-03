import Link from "next/link";
import { ArrowRight, CalendarRange, FileCheck2, PenLine, QrCode, ShieldCheck, Smartphone } from "lucide-react";
import { BrandLockup, QrMark } from "@/components/logo";

const STEPS = [
  { icon: CalendarRange, title: "Planifier", text: "Création de la réunion et ouverture des inscriptions." },
  { icon: QrCode, title: "Afficher", text: "QR imprimé en A4 ou QR dynamique projeté en salle." },
  { icon: Smartphone, title: "Scanner", text: "Le participant s'identifie depuis son téléphone." },
  { icon: PenLine, title: "Signer", text: "Signature manuscrite, contrôle des doublons." },
  { icon: FileCheck2, title: "Clôturer", text: "Liste officielle PDF authentifiée et exports." },
];

export default function HomePage() {
  return (
    <div className="bg-app-pattern min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between">
          <BrandLockup />
          <Link href="/login" className="btn-primary hidden px-4 py-2.5 text-sm sm:inline-flex">
            Back-office
          </Link>
        </header>

        <main className="my-auto grid gap-12 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-leaf/30 bg-paper px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-leaf">
              <ShieldCheck className="h-3.5 w-3.5" /> Société de Développement des Forêts
            </p>
            <h1 className="mt-5 font-display text-5xl font-semibold leading-[1.08] text-forest-deep sm:text-6xl">
              Présences officielles, <span className="text-leaf">émargement par QR code</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted">
              Application institutionnelle de gestion des réunions SODEFOR : QR sécurisé, signature manuscrite,
              contrôle des doublons, listes officielles et traçabilité complète.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="btn-primary inline-flex items-center gap-2 px-6 py-3.5 text-sm">
                Accéder au back-office <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#parcours" className="rounded-xl border border-line bg-paper px-6 py-3.5 text-sm font-semibold hover:bg-mint">
                Voir le parcours
              </a>
            </div>
          </div>

          <div className="relative mx-auto">
            <div className="absolute -inset-10 rounded-full bg-gold/15 blur-3xl" />
            <div className="card relative rotate-2 p-8 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-leaf">Liste de présence</p>
              <p className="mt-2 font-display text-xl font-semibold text-forest-deep">COMITÉ TECHNIQUE</p>
              <QrMark className="mx-auto mt-5 h-52 w-52 drop-shadow-xl" />
              <p className="mt-5 rounded-full bg-forest px-5 py-2 text-xs font-bold uppercase tracking-wide text-white">
                Scannez le QR code pour vous inscrire
              </p>
            </div>
          </div>
        </main>

        <section id="parcours" className="grid gap-3 pb-6 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <div key={title} className="card p-5">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint text-forest">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="font-display text-2xl font-semibold text-line">{String(index + 1).padStart(2, "0")}</span>
              </div>
              <p className="mt-4 font-semibold text-forest-deep">{title}</p>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
