import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guards";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { STATUS_LABELS, STATUS_TONES } from "@/lib/meeting-status";
import { formatDateTime, formatTime } from "@/lib/utils";
import { METHOD_LABELS } from "@/lib/labels";
import { MeetingActions } from "./actions";
import { LiveFeed } from "./live-feed";

export default async function MeetingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const { tab = "general", q = "" } = await searchParams;
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: {
      createdBy: true,
      qrTokens: { where: { revokedAt: null }, orderBy: { createdAt: "desc" }, take: 1 },
      documents: { orderBy: { generatedAt: "desc" }, take: 8 },
    },
  });
  if (!meeting) notFound();

  const attendances = await prisma.attendance.findMany({
    where: {
      meetingId: id,
      OR: q
        ? [
            { lastName: { contains: q } },
            { firstNames: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
            { jobTitle: { contains: q } },
            { organization: { contains: q } },
          ]
        : undefined,
    },
    orderBy: { checkInAt: "asc" },
  });

  const active = attendances.filter((a) => a.status === "ACTIVE");
  const internals = active.filter((a) => a.organization.toUpperCase().includes("SODEFOR"));
  const men = active.filter((a) => a.gender === "M");
  const first = active[0];
  const last = active[active.length - 1];

  const tabs = [
    ["general", "Vue générale"],
    ["participants", "Participants"],
    ["qr", "QR Code"],
    ["documents", "Documents"],
    ["history", "Historique"],
  ] as const;

  const logs = await prisma.auditLog.findMany({
    where: { OR: [{ entityId: id }, { entityId: { in: attendances.map((a) => a.id) } }] },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { actor: true },
  });

  return (
    <div>
      <PageHeader
        title={meeting.title}
        subtitle={`${meeting.internalRef} · ${formatDateTime(meeting.startsAt)} · ${meeting.location || "Distanciel"}`}
        actions={<MeetingActions id={meeting.id} status={meeting.status} />}
      />
      <div className="mb-5 flex items-center gap-3">
        <Badge className={STATUS_TONES[meeting.status]}>{STATUS_LABELS[meeting.status]}</Badge>
        <Link href={`/meetings/${meeting.id}/edit`} className="text-sm font-semibold text-forest">
          Modifier
        </Link>
        <Link href={`/meetings/${meeting.id}/qr`} className="text-sm font-semibold text-forest">
          QR plein écran
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["Inscrits", meeting.expectedParticipants ?? "—"],
          ["Présents", active.length],
          ["Internes", internals.length],
          ["Externes", active.length - internals.length],
          ["Hommes / Femmes", `${men.length} / ${active.length - men.length}`],
          ["Premier / dernier", `${first ? formatTime(first.checkInAt) : "—"} / ${last ? formatTime(last.checkInAt) : "—"}`],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-2 text-lg font-semibold">{value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map(([key, label]) => (
          <Link
            key={key}
            href={`/meetings/${meeting.id}?tab=${key}`}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === key ? "bg-forest text-white" : "bg-paper text-muted"}`}
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
              <div className="flex justify-between gap-4"><dt className="text-muted">Organisateur</dt><dd>{meeting.createdBy.firstName} {meeting.createdBy.lastName}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Mode QR</dt><dd>{meeting.qrMode} · niveau {meeting.qrSecurityLevel}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Invités externes</dt><dd>{meeting.allowGuests ? "Oui" : "Non"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Liste publique</dt><dd>{meeting.showPublicAttendance ? "Oui" : "Non"}</dd></div>
            </dl>
            {meeting.description ? <p className="mt-4 text-sm text-muted">{meeting.description}</p> : null}
          </Card>
          <LiveFeed meetingId={meeting.id} initialCount={active.length} />
        </div>
      ) : null}

      {tab === "participants" ? (
        <Card className="mt-6 overflow-x-auto">
          <form className="mb-4 flex gap-2">
            <input name="q" defaultValue={q} placeholder="Nom, email, téléphone, fonction, structure" className="field" />
            <input type="hidden" name="tab" value="participants" />
            <Button type="submit" variant="outline">Rechercher</Button>
            <Link href={`/meetings/${meeting.id}/participants/new`} className="btn-primary px-4 py-2.5 text-sm">Ajout manuel</Link>
          </form>
          <table className="w-full text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-2">Nom</th>
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
                <tr key={row.id} className="border-t border-line">
                  <td className="py-3 font-semibold">{row.lastName} {row.firstNames}</td>
                  <td>{row.jobTitle}</td>
                  <td>{row.organization}</td>
                  <td>{formatTime(row.checkInAt)}</td>
                  <td>{METHOD_LABELS[row.checkInMethod]}</td>
                  <td>{row.status}</td>
                  <td>
                    <Link href={`/meetings/${meeting.id}/participants/${row.id}`} className="text-forest">
                      Corriger
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      {tab === "qr" ? (
        <Card className="mt-6">
          <p className="text-sm text-muted">
            Le QR ne contient aucun identifiant numérique, email ou donnée personnelle. Il pointe vers
            une URL `/r/{"{token}"}`.
          </p>
          <div className="mt-4 flex gap-3">
            <Link href={`/meetings/${meeting.id}/qr`} className="btn-primary px-4 py-2.5 text-sm">
              Afficher le QR
            </Link>
            <a href={`/api/meetings/${meeting.id}/qr`} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold">
              Télécharger le jeton
            </a>
          </div>
        </Card>
      ) : null}

      {tab === "documents" ? (
        <Card className="mt-6">
          <div className="flex flex-wrap gap-2">
            <a href={`/api/meetings/${meeting.id}/exports/pdf`} className="btn-primary px-4 py-2.5 text-sm">PDF officiel</a>
            <a href={`/api/meetings/${meeting.id}/exports/pdf?public=1`} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold">PDF public</a>
            <a href={`/api/meetings/${meeting.id}/exports/xlsx`} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold">Excel</a>
            <a href={`/api/meetings/${meeting.id}/exports/csv`} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold">CSV</a>
          </div>
          <ul className="mt-5 space-y-2 text-sm">
            {meeting.documents.map((doc) => (
              <li key={doc.id} className="rounded-xl bg-sand p-3">
                {doc.type} · v{doc.version} · {doc.uuid}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {tab === "history" ? (
        <Card className="mt-6">
          <ul className="space-y-3 text-sm">
            {logs.map((log) => (
              <li key={log.id} className="rounded-xl bg-sand p-3">
                <p className="font-semibold">{log.action}</p>
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
