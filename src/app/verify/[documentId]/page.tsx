import { prisma } from "@/lib/prisma";
import { BrandLockup } from "@/components/logo";
import { formatDateTime } from "@/lib/utils";

export default async function VerifyPage({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const document = await prisma.generatedDocument.findUnique({
    where: { uuid: documentId },
    include: { meeting: true },
  });

  const count = document
    ? await prisma.attendance.count({
        where: { meetingId: document.meetingId, status: "ACTIVE" },
      })
    : 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand px-4">
      <div className="w-full max-w-lg">
        <BrandLockup />
        <div className="card mt-8 p-6">
          <h1 className="font-display text-2xl text-forest-deep">Vérification documentaire</h1>
          {document ? (
            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">État</dt><dd className="font-semibold text-forest">Document valide</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Objet</dt><dd>{document.meeting.title}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Date</dt><dd>{formatDateTime(document.meeting.startsAt)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Participants</dt><dd>{count}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Généré le</dt><dd>{formatDateTime(document.generatedAt)}</dd></div>
            </dl>
          ) : (
            <p className="mt-4 text-danger">Document invalide ou inconnu.</p>
          )}
          <p className="mt-6 text-xs text-muted">
            Cette page ne publie jamais la liste nominative.
          </p>
        </div>
      </div>
    </div>
  );
}
