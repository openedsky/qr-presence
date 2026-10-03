import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/guards";
import { meetingTypeChoices } from "@/server/services/meeting-types";
import { getSettings } from "@/server/services/settings";
import { secretaryOptions } from "@/server/services/meeting-input";
import { MeetingForm } from "../meeting-form";

export default async function NewMeetingPage() {
  await requirePermission("meetings.create");
  const [types, settings, secretaries] = await Promise.all([meetingTypeChoices(), getSettings(), secretaryOptions()]);
  return (
    <div>
      <PageHeader title="Créer une réunion" subtitle="Brouillon jusqu'à l'ouverture des inscriptions." />
      <MeetingForm
        actionUrl="/api/meetings"
        types={types}
        secretaries={secretaries}
        initial={{
          emailRequired: settings.emailRequiredDefault,
          signatureRequired: settings.signatureRequiredDefault,
        }}
      />
    </div>
  );
}
