import { prisma } from "@/lib/prisma";
import { BrandLockup } from "@/components/logo";
import { formatDateTime } from "@/lib/utils";
import { isOfficialListOutdated } from "@/server/services/documents";
import { HashCheck } from "./hash-check";

const TYPE_LABELS: Record<string, string> = {
  LISTE_OFFICIELLE: "Liste de présence officielle",
  LISTE_PROVISOIRE: "Liste de présence provisoire",
  LISTE_PUBLIQUE: "Liste de présence publique",
  QR_POSTER: "Affiche QR",
  STATISTIQUES: "Statistiques",
};

export default async function VerifyPage({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const document = await prisma.generatedDocument.findUnique({
    where: { uuid: documentId },
    include: { meeting: true },
  });
  const replacement =
    document?.supersededAt && document.type === "LISTE_OFFICIELLE"
      ? await prisma.generatedDocument.findFirst({
          where: { meetingId: document.meetingId, type: "LISTE_OFFICIELLE", supersededAt: null },
          orderBy: { version: "desc" },
        })
      : null;

  const reopened =
    document?.type === "LISTE_OFFICIELLE" && ["OUVERTE", "EN_COURS"].includes(document.meeting.status);
  const outdated = document && !reopened ? await isOfficialListOutdated(document) : false;

  const state = !document
    ? null
    : document.supersededAt
      ? { label: "Remplacé par une version plus récente", tone: "text-danger" }
      : reopened
        ? { label: "En révision — réunion rouverte, une nouvelle version suivra", tone: "text-amber-700" }
        : outdated
          ? { label: "Corrigée depuis son édition — une nouvelle version est en cours d'établissement", tone: "text-amber-700" }
        : document.type === "LISTE_PROVISOIRE"
          ? { label: "Document provisoire — ne fait pas foi", tone: "text-amber-700" }
          : document.type === "LISTE_PUBLIQUE"
            ? { label: "Document informatif — ne fait pas foi", tone: "text-amber-700" }
            : document.type === "LISTE_OFFICIELLE"
              ? { label: "Liste officielle en vigueur", tone: "text-forest" }
              : { label: "Document authentique", tone: "text-forest" };

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand px-4">
      <div className="w-full max-w-lg">
        <BrandLockup />
        <div className="card mt-8 p-6">
          <h1 className="font-display text-2xl text-forest-deep">Vérification documentaire</h1>
          {document && state ? (
            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-muted">État</dt><dd className={`font-semibold ${state.tone}`}>{state.label}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Document</dt><dd>{TYPE_LABELS[document.type]}{document.type === "LISTE_OFFICIELLE" ? ` · version ${document.version}` : ""}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Objet</dt><dd className="text-right">{document.meeting.title}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Date</dt><dd>{formatDateTime(document.meeting.startsAt)}</dd></div>
              {document.participantCount != null ? (
                <div className="flex justify-between gap-4"><dt className="text-muted">Participants</dt><dd>{document.participantCount}</dd></div>
              ) : null}
              <div className="flex justify-between gap-4"><dt className="text-muted">Généré le</dt><dd>{formatDateTime(document.generatedAt)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Empreinte SHA-256</dt><dd className="break-all text-right font-mono text-[11px]">{document.sha256}</dd></div>
              {document.supersededAt ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Remplacé le</dt>
                  <dd>
                    {formatDateTime(document.supersededAt)}
                    {replacement ? ` par la version ${replacement.version}` : ""}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="mt-4 text-danger">Document invalide ou inconnu.</p>
          )}
          {document ? <HashCheck expected={document.sha256} /> : null}
          <p className="mt-6 text-xs text-muted">
            Seul un fichier dont l&apos;empreinte est identique fait foi : une copie imprimée ou retouchée ne peut pas
            être authentifiée par le seul QR code. Cette page ne publie jamais la liste nominative.
          </p>
        </div>
      </div>
    </div>
  );
}
