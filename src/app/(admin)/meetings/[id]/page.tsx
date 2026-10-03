import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireMeetingPage } from "@/lib/meeting-access";
import { AlertTriangle, Download, Lock, Maximize2, Pencil, QrCode } from "lucide-react";
import { Badge, Button, Card, LinkButton, PageHeader } from "@/components/ui";
import { hasPermission } from "@/lib/rbac";
import { STATUS_LABELS, STATUS_TONES, isFrozen, registrationWindow } from "@/lib/meeting-status";
import { actionLabel } from "@/lib/audit-format";
import { formatDateTime, formatTime } from "@/lib/utils";
import { METHOD_LABELS } from "@/lib/labels";
import { MeetingActions } from "./actions";

const DOCUMENT_LABELS: Record<string, string> = {
  QR_POSTER: "Affiche QR",
  LISTE_PROVISOIRE: "Liste provisoire",
  LISTE_OFFICIELLE: "Liste officielle",
  LISTE_PUBLIQUE: "Liste publique",
  STATISTIQUES: "Statistiques",
};
import { LiveFeed } from "./live-feed";
import { internalStructureNames, normalizeLabel } from "@/server/services/structures";

const PARTICIPANTS_LIMIT = 500;

export default async function MeetingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const { id } = await params;
  const { session, meeting: gateMeeting } = await requireMeetingPage(id, "read");
  const role = session.user.role;
  const canDelete = hasPermission(role, "meetings.delete");
  const canManage = hasPermission(role, "meetings.manage_own");
  const canClose = hasPermission(role, "meetings.close");
  const canEditAttendances = hasPermission(role, "attendances.manage");
  const canExport = hasPermission(role, "attendances.export");
  const canReadDocuments = hasPermission(role, "documents.read");
  const canShowQr = hasPermission(role, "qr.display");
  const canSeeHistory = hasPermission(role, "audit.read") || canManage;
  const { tab = "general", q = "" } = await searchParams;
  const frozen = isFrozen(gateMeeting.status);
  const slot = registrationWindow(gateMeeting);

  // Indicateurs calculés en base : la liste détaillée n'est lue que sur l'onglet Participants.
  const activeWhere = { meetingId: id, status: "ACTIVE" as const };
  const [people, groups, span, byOrganization, internalNames, currentOfficial] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: [gateMeeting.createdById, gateMeeting.secretaryId].filter((value): value is string => Boolean(value)) } },
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.attendance.groupBy({
      by: ["status", "gender", "suspectedDuplicate"],
      where: { meetingId: id },
      _count: { _all: true },
    }),
    prisma.attendance.aggregate({ where: activeWhere, _min: { checkInAt: true }, _max: { checkInAt: true } }),
    prisma.attendance.groupBy({ by: ["organization"], where: activeWhere, _count: { _all: true } }),
    internalStructureNames(),
    prisma.generatedDocument.findFirst({
      where: { meetingId: id, type: "LISTE_OFFICIELLE", supersededAt: null },
      orderBy: { version: "desc" },
      select: { id: true, version: true },
    }),
  ]);
  const sum = (keep: (group: (typeof groups)[number]) => boolean) =>
    groups.filter(keep).reduce((total, group) => total + group._count._all, 0);
  const total = sum(() => true);
  const activeCount = sum((group) => group.status === "ACTIVE");
  const men = sum((group) => group.status === "ACTIVE" && group.gender === "M");
  const suspected = sum((group) => group.status === "ACTIVE" && group.suspectedDuplicate);
  const person = (userId: string | null) => people.find((user) => user.id === userId) ?? null;
  const meeting = { ...gateMeeting, createdBy: person(gateMeeting.createdById), secretary: person(gateMeeting.secretaryId) };
  const internalSet = new Set(internalNames.map(normalizeLabel));
  const internals = byOrganization
    .filter((row) => internalSet.has(normalizeLabel(row.organization)))
    .reduce((sum, row) => sum + row._count._all, 0);
  const first = span._min.checkInAt;
  const last = span._max.checkInAt;

  const needle = q.trim().slice(0, 100);
  const attendances =
    tab === "participants"
      ? await prisma.attendance.findMany({
          where: {
            meetingId: id,
            ...(needle
              ? {
                  OR: [
                    { lastName: { contains: needle } },
                    { firstNames: { contains: needle } },
                    { email: { contains: needle } },
                    { phone: { contains: needle } },
                    { jobTitle: { contains: needle } },
                    { organization: { contains: needle } },
                  ],
                }
              : {}),
          },
          select: {
            id: true,
            lastName: true,
            firstNames: true,
            jobTitle: true,
            organization: true,
            checkInAt: true,
            checkInMethod: true,
            manualReason: true,
            status: true,
            suspectedDuplicate: true,
          },
          orderBy: { checkInAt: "asc" },
          take: PARTICIPANTS_LIMIT + 1,
        })
      : [];
  const truncated = attendances.length > PARTICIPANTS_LIMIT;
  if (truncated) attendances.length = PARTICIPANTS_LIMIT;

  const tabs = [
    ["general", "Vue générale"],
    ["participants", "Participants"],
    ["qr", "QR Code"],
    ["documents", "Documents"],
    ...(canSeeHistory ? ([["history", "Historique"]] as const) : []),
  ] as const;

  const documents =
    tab === "documents"
      ? await prisma.generatedDocument.findMany({ where: { meetingId: id }, orderBy: { generatedAt: "desc" }, take: 100 })
      : [];
  const logs =
    canSeeHistory && tab === "history"
      ? await prisma.auditLog.findMany({
          where: { meetingId: id },
          orderBy: { createdAt: "desc" },
          take: 30,
          include: { actor: { select: { firstName: true, lastName: true } } },
        })
      : [];

  return (
    <div>
      <PageHeader
        title={meeting.title}
        subtitle={`${meeting.internalRef} · ${formatDateTime(meeting.startsAt)} · ${meeting.location || "Distanciel"}`}
        actions={
          canManage || canClose ? (
            <MeetingActions
              id={meeting.id}
              status={meeting.status}
              canManage={canManage}
              canClose={canClose}
              canArchive={hasPermission(role, "meetings.archive")}
              canDuplicate={hasPermission(role, "meetings.create")}
              canDelete={canDelete}
              canReopen={hasPermission(role, "meetings.reopen")}
              hasAttendances={total > 0}
            />
          ) : null
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge className={STATUS_TONES[meeting.status]}>{STATUS_LABELS[meeting.status]}</Badge>
        {frozen ? (
          <Badge className="bg-amber-50 text-amber-800">
            <Lock className="mr-1 inline h-3 w-3" />
            Liste gelée{currentOfficial ? ` · officielle v${currentOfficial.version}` : ""}
          </Badge>
        ) : null}
        {meeting.autoClosed && frozen ? (
          <Badge className="bg-sky-50 text-sky-800">Clôture automatique</Badge>
        ) : null}
        {meeting.purgedAt ? (
          <Badge className="bg-stone-100 text-stone-700">Données anonymisées le {formatDateTime(meeting.purgedAt)}</Badge>
        ) : null}
        {canManage && !frozen ? (
          <LinkButton href={`/meetings/${meeting.id}/edit`} variant="ghost" className="px-3 py-1.5">
            <Pencil className="h-4 w-4" /> Modifier
          </LinkButton>
        ) : null}
        {canShowQr ? (
          <LinkButton href={`/meetings/${meeting.id}/qr`} variant="ghost" className="px-3 py-1.5">
            <Maximize2 className="h-4 w-4" /> QR plein écran
          </LinkButton>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["Inscrits", meeting.expectedParticipants ?? "—"],
          ["Présents", activeCount],
          ["Internes", internals],
          ["Externes", activeCount - internals],
          ["Hommes / Femmes", `${men} / ${activeCount - men}`],
          ["Premier / dernier", `${first ? formatTime(first) : "—"} / ${last ? formatTime(last) : "—"}`],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-2 font-display text-2xl font-semibold text-forest-deep">{value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-8 flex w-fit flex-wrap gap-1 rounded-2xl border border-line bg-paper p-1 shadow-sm">
        {tabs.map(([key, label]) => (
          <Link
            key={key}
            href={`/meetings/${meeting.id}?tab=${key}`}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === key ? "bg-forest text-white shadow" : "text-muted hover:bg-mint hover:text-forest"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {tab === "general" ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="font-display text-xl">Informations</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-muted">Organisateur</dt><dd>{meeting.createdBy ? `${meeting.createdBy.firstName} ${meeting.createdBy.lastName}` : "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Secrétaire de séance</dt><dd>{meeting.secretary ? `${meeting.secretary.firstName} ${meeting.secretary.lastName}` : "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Fenêtre d&apos;émargement</dt><dd className="text-right">{formatDateTime(slot.opensAt)} → {formatDateTime(slot.closesAt)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Mode QR</dt><dd>{meeting.qrMode} · niveau {meeting.qrSecurityLevel}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Invités externes</dt><dd>{meeting.allowGuests ? "Oui" : "Non"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Liste publique</dt><dd>{meeting.showPublicAttendance ? "Oui" : "Non"}</dd></div>
            </dl>
            {meeting.description ? <p className="mt-4 text-sm text-muted">{meeting.description}</p> : null}
          </Card>
          <LiveFeed meetingId={meeting.id} initialCount={activeCount} />
        </div>
      ) : null}

      {tab === "participants" ? (
        <Card className="mt-6 overflow-x-auto">
          {suspected > 0 ? (
            <p className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {suspected} présence(s) portent le même nom qu&apos;un autre participant : vérifiez s&apos;il s&apos;agit d&apos;homonymes ou d&apos;un doublon.
            </p>
          ) : null}
          {meeting.status === "CLOTUREE" && canEditAttendances ? (
            <p className="mb-4 flex items-center gap-2 rounded-xl bg-sand px-3 py-2 text-sm text-muted">
              <Lock className="h-4 w-4 shrink-0" />
              Réunion clôturée : chaque correction exige un motif et produit une nouvelle version de la liste officielle.
            </p>
          ) : null}
          <form className="mb-4 flex gap-2">
            <input name="q" defaultValue={q} placeholder="Nom, email, téléphone, fonction, structure" className="field" />
            <input type="hidden" name="tab" value="participants" />
            <Button type="submit" variant="outline">Rechercher</Button>
            {canEditAttendances && ["OUVERTE", "EN_COURS", "CLOTUREE"].includes(meeting.status) ? (
              <Link href={`/meetings/${meeting.id}/participants/new`} className="btn-primary px-4 py-2.5 text-sm">Ajout manuel</Link>
            ) : null}
          </form>
          <table className="data-table w-full text-sm">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Fonction</th>
                <th>Structure</th>
                <th>Heure</th>
                <th>Mode</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {attendances.map((row) => (
                <tr key={row.id}>
                  <td className="font-semibold">
                    {row.lastName} {row.firstNames}
                    {row.suspectedDuplicate && row.status === "ACTIVE" ? (
                      <Badge className="ml-2 bg-amber-50 text-amber-800">Homonyme à vérifier</Badge>
                    ) : null}
                  </td>
                  <td>{row.jobTitle}</td>
                  <td>{row.organization}</td>
                  <td>{formatTime(row.checkInAt)}</td>
                  <td>
                    {METHOD_LABELS[row.checkInMethod]}
                    {row.manualReason ? (
                      <span className="block text-xs text-amber-800" title={row.manualReason}>
                        Dérogation : {row.manualReason}
                      </span>
                    ) : null}
                  </td>
                  <td>{row.status === "ACTIVE" ? "Présent" : "Annulée"}</td>
                  <td>
                    {canEditAttendances ? (
                      <Link href={`/meetings/${meeting.id}/participants/${row.id}`} className="text-forest">
                        {meeting.status === "ARCHIVEE" ? "Consulter" : "Corriger"}
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {truncated ? (
            <p className="mt-4 text-sm text-muted">
              Affichage limité aux {PARTICIPANTS_LIMIT} premières présences : affinez la recherche, ou utilisez l&apos;export
              Excel pour la liste complète.
            </p>
          ) : null}
        </Card>
      ) : null}

      {tab === "qr" ? (
        <Card className="mt-6 p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-mint text-forest">
              <QrCode className="h-8 w-8" />
            </span>
            <div className="flex-1">
              <h2 className="font-display text-xl font-semibold text-forest-deep">
                QR code {meeting.qrMode === "DYNAMIC" ? "dynamique" : "statique"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Le QR ne contient aucun identifiant numérique, email ou donnée personnelle : il pointe vers une URL
                sécurisée <code>/r/{"{token}"}</code>.
                {meeting.qrMode === "DYNAMIC"
                  ? " Il se renouvelle automatiquement et doit être affiché à l'écran de la salle."
                  : " Téléchargez l'affiche A4 pour l'imprimer ou l'insérer dans une convocation."}
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {canShowQr ? (
              <LinkButton href={`/meetings/${meeting.id}/qr`}>
                <Maximize2 className="h-4 w-4" /> Afficher le QR
              </LinkButton>
            ) : (
              <p className="text-sm text-muted">Votre rôle ne permet pas d&apos;afficher le QR code d&apos;émargement.</p>
            )}
            {canShowQr && meeting.qrMode === "STATIC" ? (
              <LinkButton href={`/api/meetings/${meeting.id}/qr/poster`} variant="gold" download>
                <Download className="h-4 w-4" /> Télécharger pour impression (A4)
              </LinkButton>
            ) : null}
          </div>
        </Card>
      ) : null}

      {tab === "documents" ? (
        <Card className="mt-6">
          <p className="mb-4 text-sm text-muted">
            {frozen
              ? "La liste officielle a été établie à la clôture. Elle n'est régénérée (version suivante, « annule et remplace ») qu'après une correction motivée."
              : "Avant la clôture, le PDF est une liste provisoire qui ne fait pas foi. La liste officielle est établie automatiquement à la clôture."}
          </p>
          {canExport ? (
            <div className="flex flex-wrap gap-2">
              <a href={`/api/meetings/${meeting.id}/exports/pdf`} className="btn-primary px-4 py-2.5 text-sm">
                {frozen ? "PDF officiel" : "PDF provisoire"}
              </a>
              {meeting.showPublicAttendance ? (
                <a href={`/api/meetings/${meeting.id}/exports/pdf?public=1`} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold">PDF public</a>
              ) : null}
              <a href={`/api/meetings/${meeting.id}/exports/xlsx`} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold">Excel</a>
              <a href={`/api/meetings/${meeting.id}/exports/csv`} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold">CSV</a>
            </div>
          ) : null}
          <ul className="mt-5 space-y-2 text-sm">
            {documents.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sand p-3">
                <span>
                  <span className="font-semibold">{DOCUMENT_LABELS[doc.type]}</span>
                  {doc.type === "LISTE_OFFICIELLE" ? ` · version ${doc.version}` : ""}
                  {doc.participantCount != null ? ` · ${doc.participantCount} participant(s)` : ""}
                  <span className="block text-xs text-muted">
                    {formatDateTime(doc.generatedAt)}
                    {doc.supersededAt ? ` · remplacée le ${formatDateTime(doc.supersededAt)}` : ""}
                    {doc.correctionNote ? ` · motif : ${doc.correctionNote}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  {doc.type === "LISTE_OFFICIELLE" ? (
                    <Badge className={doc.id === currentOfficial?.id ? "bg-emerald-50 text-emerald-800" : "bg-stone-100 text-stone-600"}>
                      {doc.id === currentOfficial?.id ? "En vigueur" : "Remplacée"}
                    </Badge>
                  ) : null}
                  {canReadDocuments ? (
                    <a href={`/api/files/${doc.objectKey}`} className="font-semibold text-forest" download>
                      Télécharger
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {tab === "history" && canSeeHistory ? (
        <Card className="mt-6">
          <ul className="space-y-3 text-sm">
            {logs.map((log) => (
              <li key={log.id} className="rounded-xl bg-sand p-3">
                <p className="font-semibold">{actionLabel(log.action)}</p>
                <p className="text-xs text-muted">
                  {formatDateTime(log.createdAt)} · {log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : "Système"}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
