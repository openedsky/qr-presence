import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import ExcelJS from "exceljs";
import { createHash } from "crypto";
import type { Attendance, Meeting, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getObjectBuffer, meetingObjectKey, putObject } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";
import { formatDate, formatDateTime, formatTime } from "@/lib/utils";
import { verifyDocumentUrl } from "@/lib/tokens";
import { getSettings } from "./settings";

type AttendanceRow = Attendance;

const FOREST = rgb(0.08, 0.24, 0.14);
const INK = rgb(0.11, 0.14, 0.12);
const MUTED = rgb(0.35, 0.4, 0.36);

function civilityLabel(value: string) {
  return value === "M" ? "M." : value === "MME" ? "Mme" : "Mlle";
}

async function embedSignature(pdf: PDFDocument, key?: string | null) {
  if (!key) return null;
  const buffer = await getObjectBuffer(key);
  if (!buffer) return null;
  try {
    return await pdf.embedPng(buffer);
  } catch {
    try {
      return await pdf.embedJpg(buffer);
    } catch {
      return null;
    }
  }
}

export async function buildOfficialPdf(input: {
  meeting: Meeting;
  attendances: AttendanceRow[];
  actor?: User | null;
  publicList?: boolean;
}) {
  const settings = await getSettings();
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 36;
  let page = pdf.addPage([841.89, 595.28]);
  let { width, height } = page.getSize();
  let y = height - 32;
  const generatedAt = new Date();
  const documentUuid = crypto.randomUUID();

  const drawHeader = () => {
    page.drawText(settings.ministryName.toUpperCase(), {
      x: margin,
      y,
      size: 9,
      font: fontBold,
      color: FOREST,
    });
    page.drawText(settings.organizationName, {
      x: width - margin - 90,
      y,
      size: 11,
      font: fontBold,
      color: FOREST,
    });
    y -= 18;
    page.drawText(
      input.publicList ? "LISTE DE PRÉSENCE — VERSION PUBLIQUE" : "LISTE DE PRÉSENCE",
      { x: margin, y, size: 16, font: fontBold, color: INK },
    );
    y -= 16;
    page.drawText(input.meeting.title, { x: margin, y, size: 11, font, color: INK });
    y -= 13;
    page.drawText(
      `${formatDate(input.meeting.startsAt)}  •  ${input.meeting.location || "Réunion distante"}  •  ${input.meeting.internalRef}`,
      { x: margin, y, size: 9, font, color: MUTED },
    );
    y -= 18;
  };

  drawHeader();

  const publicCols = [
    { label: "N°", w: 28 },
    { label: "Nom et prénom", w: 180 },
    { label: "Fonction", w: 150 },
    { label: "Structure", w: 170 },
    { label: "Heure", w: 70 },
  ];
  const adminCols = [
    { label: "N°", w: 24 },
    { label: "Nom et prénom", w: 130 },
    { label: "Civ.", w: 28 },
    { label: "Fonction", w: 95 },
    { label: "Structure", w: 95 },
    { label: "Email", w: 110 },
    { label: "Contact", w: 80 },
    { label: "Signature", w: 80 },
    { label: "Heure", w: 50 },
  ];
  const cols = input.publicList ? publicCols : adminCols;

  const drawTableHeader = () => {
    let x = margin;
    page.drawRectangle({
      x: margin,
      y: y - 4,
      width: cols.reduce((s, c) => s + c.w, 0),
      height: 16,
      color: rgb(0.91, 0.95, 0.91),
    });
    for (const col of cols) {
      page.drawText(col.label, { x: x + 3, y, size: 7, font: fontBold, color: FOREST });
      x += col.w;
    }
    y -= 16;
  };

  drawTableHeader();

  const rows = input.attendances.filter((a) => a.status === "ACTIVE");
  let index = 1;
  for (const row of rows) {
    if (y < 70) {
      page.drawText(
        `${input.meeting.internalRef}  •  ${rows.length} participants  •  ${documentUuid}`,
        { x: margin, y: 28, size: 7, font, color: MUTED },
      );
      page = pdf.addPage([841.89, 595.28]);
      ({ width, height } = page.getSize());
      y = height - 32;
      drawHeader();
      drawTableHeader();
    }

    const name = `${row.lastName} ${row.firstNames}`;
    const values = input.publicList
      ? [String(index), name, row.jobTitle, row.organization, formatTime(row.checkInAt)]
      : [
          String(index),
          name,
          civilityLabel(row.civility),
          row.jobTitle,
          row.organization,
          row.email ?? "",
          row.phone ?? "",
          "",
          formatTime(row.checkInAt),
        ];

    let x = margin;
    values.forEach((value, i) => {
      page.drawText(String(value).slice(0, 42), {
        x: x + 3,
        y,
        size: 7,
        font,
        color: INK,
      });
      x += cols[i].w;
    });

    if (!input.publicList && row.signatureObjectKey) {
      const img = await embedSignature(pdf, row.signatureObjectKey);
      if (img) {
        const sigX = margin + cols.slice(0, 7).reduce((s, c) => s + c.w, 0);
        page.drawImage(img, { x: sigX + 4, y: y - 4, width: 70, height: 16 });
      }
    }

    y -= 18;
    index += 1;
  }

  page.drawText(
    `Réf. ${input.meeting.internalRef}  •  ${rows.length} participant(s)  •  Édité le ${formatDateTime(generatedAt)}  •  ${input.actor ? `${input.actor.firstName} ${input.actor.lastName}` : "Système"}  •  ${documentUuid}`,
    { x: margin, y: 28, size: 7, font, color: MUTED },
  );

  const bytes = await pdf.save();
  const buffer = Buffer.from(bytes);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const objectKey = meetingObjectKey(
    input.meeting.uuid,
    "exports",
    `${input.publicList ? "liste-publique" : "liste-officielle"}-${documentUuid}.pdf`,
  );
  await putObject(objectKey, buffer, "application/pdf");

  const doc = await prisma.generatedDocument.create({
    data: {
      meetingId: input.meeting.id,
      type: input.publicList ? "LISTE_PUBLIQUE" : "LISTE_OFFICIELLE",
      uuid: documentUuid,
      objectKey,
      sha256,
      generatedById: input.actor?.id,
    },
  });

  if (input.actor) {
    await writeAudit({
      actorId: input.actor.id,
      action: "document.pdf",
      entity: "GeneratedDocument",
      entityId: doc.id,
      afterData: { meetingId: input.meeting.id, publicList: Boolean(input.publicList) },
    });
  }

  return { buffer, document: doc, verifyUrl: verifyDocumentUrl(doc.uuid) };
}

export async function buildExcel(meeting: Meeting, attendances: Attendance[], actorId?: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SODEFOR Présences";
  const sheet = workbook.addWorksheet("Présences");
  sheet.columns = [
    { header: "N°", key: "n", width: 6 },
    { header: "Civilité", key: "civility", width: 10 },
    { header: "Nom", key: "lastName", width: 20 },
    { header: "Prénoms", key: "firstNames", width: 22 },
    { header: "Genre", key: "gender", width: 8 },
    { header: "Fonction", key: "jobTitle", width: 24 },
    { header: "Structure", key: "organization", width: 24 },
    { header: "Email", key: "email", width: 28 },
    { header: "Contact", key: "phone", width: 18 },
    { header: "Heure", key: "checkInAt", width: 22 },
    { header: "Mode", key: "method", width: 16 },
    { header: "Statut", key: "status", width: 12 },
    { header: "Confirmation", key: "code", width: 16 },
  ];
  attendances.forEach((row, i) => {
    sheet.addRow({
      n: i + 1,
      civility: row.civility,
      lastName: row.lastName,
      firstNames: row.firstNames,
      gender: row.gender,
      jobTitle: row.jobTitle,
      organization: row.organization,
      email: row.email,
      phone: row.phone,
      checkInAt: formatDateTime(row.checkInAt),
      method: row.checkInMethod,
      status: row.status,
      code: row.confirmationCode,
    });
  });
  sheet.getRow(1).font = { bold: true, color: { argb: "FF14532D" } };

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  if (actorId) {
    await writeAudit({
      actorId,
      action: "export.xlsx",
      entity: "Meeting",
      entityId: meeting.id,
    });
  }
  return buffer;
}

export function buildCsv(attendances: Attendance[]) {
  const header = [
    "N°",
    "Civilité",
    "Nom",
    "Prénoms",
    "Fonction",
    "Structure",
    "Email",
    "Contact",
    "Heure",
    "Mode",
    "Statut",
  ];
  const lines = attendances.map((row, i) =>
    [
      i + 1,
      row.civility,
      row.lastName,
      row.firstNames,
      row.jobTitle,
      row.organization,
      row.email ?? "",
      row.phone ?? "",
      formatDateTime(row.checkInAt),
      row.checkInMethod,
      row.status,
    ]
      .map((v) => `"${String(v).replaceAll('"', '""')}"`)
      .join(";"),
  );
  return [header.join(";"), ...lines].join("\n");
}
