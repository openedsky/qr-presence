"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, FileText, MapPin, QrCode, Settings2 } from "lucide-react";
import { Button, Card, Field, Input, RequiredLegend, SectionTitle, Select, Textarea } from "@/components/ui";
import { notifyError, readError, setFlash } from "@/lib/alerts";
import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/utils";

type Values = {
  title: string;
  internalRef?: string;
  description?: string;
  type: string;
  location?: string;
  videoConferenceUrl?: string;
  startsAt: string;
  endsAt?: string;
  registrationOpensAt?: string;
  registrationClosesAt?: string;
  toleranceMinutes: number;
  qrMode: string;
  qrSecurityLevel: number;
  allowGuests: boolean;
  showPublicAttendance: boolean;
  expectedParticipants?: number;
  signatureRequired: boolean;
  emailRequired: boolean;
  internalNotes?: string;
  secretaryId?: string;
};

/** Heures affichées et saisies à l'heure d'Abidjan (UTC+0), quel que soit le fuseau de l'ordinateur. */
const toLocal = toDateTimeLocal;

function splitLocal(value?: string | Date | null) {
  const local = toLocal(value);
  return local ? { date: local.slice(0, 10), time: local.slice(11, 16) } : { date: "", time: "" };
}

function join(date: FormDataEntryValue | null, time: FormDataEntryValue | null, fallbackTime = "") {
  const d = String(date ?? "").trim();
  const t = String(time ?? "").trim() || fallbackTime;
  return d && t ? `${d}T${t}` : "";
}

export function MeetingForm({
  actionUrl,
  method = "POST",
  initial,
  types,
  secretaries = [],
}: {
  actionUrl: string;
  method?: "POST" | "PATCH";
  initial?: Partial<Values>;
  types: { code: string; label: string }[];
  secretaries?: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState(initial?.videoConferenceUrl ?? "");
  const [qrMode, setQrMode] = useState(initial?.qrMode ?? "STATIC");
  // Anciennes réunions : mode et niveau peuvent diverger ; le mode (affiches déjà diffusées) fait foi.
  const [securityLevel, setSecurityLevel] = useState(() => {
    const level = initial?.qrSecurityLevel ?? 1;
    return String((initial?.qrMode ?? "STATIC") === "DYNAMIC" ? 3 : Math.min(Math.max(level, 1), 2));
  });
  const start = splitLocal(initial?.startsAt);
  const end = splitLocal(initial?.endsAt);
  const isRemote = remoteUrl.trim().length > 0;

  function onSecurityChange(value: string) {
    setSecurityLevel(value);
    setQrMode(Number(value) >= 3 ? "DYNAMIC" : "STATIC");
  }

  function onModeChange(value: string) {
    setQrMode(value);
    if (value === "DYNAMIC" && Number(securityLevel) < 3) setSecurityLevel("3");
    if (value === "STATIC" && Number(securityLevel) >= 3) setSecurityLevel("1");
  }

  async function onSubmit(formData: FormData) {
    const startsAt = join(formData.get("startDate"), formData.get("startTime"));
    const endsAt = join(formData.get("endDate") || formData.get("startDate"), formData.get("endTime"));
    const registrationOpensAt = String(formData.get("registrationOpensAt") || "");
    const registrationClosesAt = String(formData.get("registrationClosesAt") || "");

    const at = (value: string) => fromDateTimeLocal(value)?.getTime() ?? 0;
    if (String(formData.get("endDate") || "").trim() && !String(formData.get("endTime") || "").trim()) {
      await notifyError("Horaires incomplets", "Indiquez l'heure de fin, ou videz la date de fin.");
      return;
    }
    if (endsAt && at(endsAt) <= at(startsAt)) {
      await notifyError("Horaires incohérents", "L'heure de fin doit être postérieure au début de la réunion.");
      return;
    }
    if (registrationOpensAt && registrationClosesAt && at(registrationClosesAt) <= at(registrationOpensAt)) {
      await notifyError("Émargement incohérent", "La fermeture de l'émargement doit suivre son ouverture.");
      return;
    }

    setPending(true);
    const payload = {
      title: String(formData.get("title") || "").trim(),
      internalRef: formData.get("internalRef"),
      description: formData.get("description"),
      type: formData.get("type"),
      location: String(formData.get("location") || "").trim(),
      videoConferenceUrl: String(formData.get("videoConferenceUrl") || "").trim(),
      startsAt,
      endsAt,
      registrationOpensAt,
      registrationClosesAt,
      toleranceMinutes: Number(formData.get("toleranceMinutes") || 15),
      qrMode,
      qrSecurityLevel: Number(securityLevel),
      allowGuests: formData.get("allowGuests") === "on",
      showPublicAttendance: formData.get("showPublicAttendance") === "on",
      expectedParticipants: formData.get("expectedParticipants")
        ? Number(formData.get("expectedParticipants"))
        : undefined,
      signatureRequired: formData.get("signatureRequired") === "on",
      emailRequired: formData.get("emailRequired") === "on",
      internalNotes: formData.get("internalNotes"),
      secretaryId: String(formData.get("secretaryId") || ""),
    };

    let json: { id: string };
    try {
      const res = await fetch(actionUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setPending(false);
        await notifyError("Enregistrement impossible", await readError(res, "Vérifiez les champs obligatoires."));
        return;
      }
      json = (await res.json()) as { id: string };
    } catch {
      setPending(false);
      await notifyError("Enregistrement impossible", "Connexion au serveur interrompue. Réessayez.");
      return;
    }
    setFlash({
      icon: "success",
      title: method === "POST" ? "Réunion créée" : "Réunion mise à jour",
      text: method === "POST" ? "Vous pouvez maintenant ouvrir les inscriptions." : undefined,
    });
    router.push(`/meetings/${json.id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(new FormData(event.currentTarget));
      }}
      className="grid gap-6"
    >
      <RequiredLegend />

      <Card className="p-6">
        <SectionTitle icon={<FileText className="h-4 w-4" />} title="Identification" subtitle="Objet et nature de la réunion." />
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Objet de la réunion" required className="md:col-span-2" htmlFor="title">
            <Input
              id="title"
              name="title"
              required
              minLength={3}
              maxLength={180}
              defaultValue={initial?.title}
              placeholder="Ex. : Comité technique de suivi des plantations"
            />
          </Field>
          <Field label="Type" required htmlFor="type">
            <Select id="type" name="type" required defaultValue={initial?.type ?? types[0]?.code}>
              {types.map((type) => (
                <option key={type.code} value={type.code}>
                  {type.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Référence interne" htmlFor="internalRef" hint="Générée automatiquement si vide.">
            <Input id="internalRef" name="internalRef" maxLength={40} defaultValue={initial?.internalRef} placeholder="REU-2026-0001" />
          </Field>
          <Field label="Description" className="md:col-span-2" htmlFor="description">
            <Textarea id="description" name="description" defaultValue={initial?.description} placeholder="Ordre du jour, objectifs…" />
          </Field>
        </div>
      </Card>

      <Card className="p-6">
        <SectionTitle icon={<CalendarClock className="h-4 w-4" />} title="Date et horaires" subtitle="Planification de la séance." />
        <div className="grid gap-5 md:grid-cols-4">
          <Field label="Date" required htmlFor="startDate">
            <Input id="startDate" type="date" name="startDate" required defaultValue={start.date} />
          </Field>
          <Field label="Heure de début" required htmlFor="startTime">
            <Input id="startTime" type="time" name="startTime" required defaultValue={start.time} />
          </Field>
          <Field label="Date de fin" htmlFor="endDate" hint="Même jour si vide.">
            <Input id="endDate" type="date" name="endDate" defaultValue={end.date} />
          </Field>
          <Field label="Heure de fin" htmlFor="endTime">
            <Input id="endTime" type="time" name="endTime" defaultValue={end.time} />
          </Field>
          <Field label="Participants attendus" htmlFor="expectedParticipants">
            <Input id="expectedParticipants" type="number" min={0} max={20000} name="expectedParticipants" defaultValue={initial?.expectedParticipants} />
          </Field>
        </div>
      </Card>

      <Card className="p-6">
        <SectionTitle icon={<MapPin className="h-4 w-4" />} title="Lieu" subtitle="Le lieu est obligatoire, sauf pour une réunion à distance." />
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="Lieu"
            required={!isRemote}
            htmlFor="location"
            hint={isRemote ? "Facultatif : un lien de visioconférence est renseigné." : undefined}
          >
            <Input id="location" name="location" required={!isRemote} maxLength={180} defaultValue={initial?.location} placeholder="Salle de conférence, siège SODEFOR" />
          </Field>
          <Field label="Lien visioconférence" htmlFor="videoConferenceUrl" hint="Renseignez-le pour une réunion à distance.">
            <Input
              id="videoConferenceUrl"
              type="url"
              name="videoConferenceUrl"
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              placeholder="https://…"
            />
          </Field>
        </div>
      </Card>

      <Card className="p-6">
        <SectionTitle icon={<QrCode className="h-4 w-4" />} title="Émargement et QR code" subtitle="Fenêtre d'inscription et niveau de sécurité." />
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Ouverture émargement" htmlFor="registrationOpensAt">
            <Input id="registrationOpensAt" type="datetime-local" name="registrationOpensAt" defaultValue={toLocal(initial?.registrationOpensAt)} />
          </Field>
          <Field label="Fermeture émargement" htmlFor="registrationClosesAt">
            <Input id="registrationClosesAt" type="datetime-local" name="registrationClosesAt" defaultValue={toLocal(initial?.registrationClosesAt)} />
          </Field>
          <Field label="Tolérance (minutes)" required htmlFor="toleranceMinutes">
            <Input id="toleranceMinutes" type="number" min={0} max={240} required name="toleranceMinutes" defaultValue={initial?.toleranceMinutes ?? 15} />
          </Field>
          <Field label="Mode QR" required htmlFor="qrMode">
            <Select id="qrMode" name="qrMode" required value={qrMode} onChange={(e) => onModeChange(e.target.value)}>
              <option value="STATIC">Statique (imprimable)</option>
              <option value="DYNAMIC">Dynamique (écran)</option>
            </Select>
          </Field>
          <Field label="Niveau de sécurité QR" required htmlFor="qrSecurityLevel" className="md:col-span-2">
            <Select id="qrSecurityLevel" name="qrSecurityLevel" required value={securityLevel} onChange={(e) => onSecurityChange(e.target.value)}>
              <option value="1">1 — QR statique (affiche imprimable)</option>
              <option value="2">2 — QR statique, un seul émargement par téléphone</option>
              <option value="3">3 — QR dynamique renouvelé à l&apos;écran</option>
            </Select>
          </Field>
          <p className="text-xs text-muted md:col-span-2 xl:col-span-4">
            Heures exprimées à l&apos;heure d&apos;Abidjan. Quel que soit le niveau, l&apos;émargement n&apos;est accepté que
            pendant la fenêtre : de l&apos;ouverture (ou début − tolérance) à la fermeture (ou fin + tolérance ; début + 12 h
            sans heure de fin). La réunion est ensuite clôturée automatiquement.
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <SectionTitle icon={<Settings2 className="h-4 w-4" />} title="Options" subtitle="Règles appliquées au formulaire public." />
        <div className="grid gap-3 md:grid-cols-2">
          <label className="check-tile">
            <input type="checkbox" name="signatureRequired" defaultChecked={initial?.signatureRequired ?? true} />
            <span><strong className="block">Signature obligatoire</strong><span className="text-muted">Signature manuscrite sur l&apos;écran.</span></span>
          </label>
          <label className="check-tile">
            <input type="checkbox" name="emailRequired" defaultChecked={initial?.emailRequired ?? true} />
            <span><strong className="block">Email obligatoire</strong><span className="text-muted">Le participant doit renseigner son email.</span></span>
          </label>
          <label className="check-tile">
            <input type="checkbox" name="allowGuests" defaultChecked={initial?.allowGuests ?? true} />
            <span><strong className="block">Invités externes autorisés</strong><span className="text-muted">Personnes hors SODEFOR.</span></span>
          </label>
          <label className="check-tile">
            <input type="checkbox" name="showPublicAttendance" defaultChecked={initial?.showPublicAttendance ?? false} />
            <span><strong className="block">Liste publique visible</strong><span className="text-muted">Liste consultable depuis le QR.</span></span>
          </label>
        </div>
        <Field
          label="Secrétaire de séance"
          className="mt-5"
          htmlFor="secretaryId"
          hint="Le secrétaire affecté peut afficher le QR, gérer les présences et clôturer cette réunion."
        >
          <Select id="secretaryId" name="secretaryId" defaultValue={initial?.secretaryId ?? ""}>
            <option value="">Aucun secrétaire affecté</option>
            {secretaries.map((secretary) => (
              <option key={secretary.id} value={secretary.id}>
                {secretary.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes internes" className="mt-5" htmlFor="internalNotes">
          <Textarea id="internalNotes" name="internalNotes" defaultValue={initial?.internalNotes} placeholder="Visibles uniquement dans le back-office." />
        </Field>
      </Card>

      <div className="sticky bottom-4 z-10 flex flex-col items-center justify-between gap-3 rounded-2xl border border-line bg-paper/90 p-4 shadow-lg backdrop-blur sm:flex-row">
        <RequiredLegend />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Annuler
          </Button>
          <Button loading={pending}>{pending ? "Enregistrement…" : "Enregistrer la réunion"}</Button>
        </div>
      </div>
    </form>
  );
}
