import { requirePermission } from "@/lib/guards";
import { getSettings } from "@/server/services/settings";
import { Card, PageHeader } from "@/components/ui";
import { SettingsForm } from "./form";

export default async function SettingsPage() {
  await requirePermission("settings.manage");
  const settings = await getSettings();

  return (
    <div>
      <PageHeader title="Paramètres généraux" subtitle="Organisation unique SODEFOR, conservation, sécurité QR et mentions." />
      <Card>
        <SettingsForm settings={settings} />
      </Card>
    </div>
  );
}
