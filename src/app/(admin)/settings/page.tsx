import Link from "next/link";
import { Building2, ImageIcon, Palette, Settings2, Tags } from "lucide-react";
import { internalEmailDomains } from "@/server/services/structures";
import { StructuresManager } from "./structures";
import { qrPngDataUrl } from "@/lib/qr";
import { appBaseUrl } from "@/lib/tokens";
import { defaultLogo, getLogo } from "@/server/services/branding";
import { LogoForm } from "./logo-form";
import { requirePermission } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/server/services/settings";
import { listMeetingTypes } from "@/server/services/meeting-types";
import { Card, PageHeader } from "@/components/ui";
import { cn } from "@/lib/utils";
import { SettingsForm } from "./form";
import { AppearanceForm } from "./appearance-form";
import { MeetingTypesManager } from "./meeting-types";

const TABS = [
  { key: "general", label: "Général", icon: Settings2 },
  { key: "appearance", label: "Apparence", icon: Palette },
  { key: "logo", label: "Logo", icon: ImageIcon },
  { key: "types", label: "Types de réunion", icon: Tags },
  { key: "structures", label: "Structures", icon: Building2 },
] as const;

type Tab = (typeof TABS)[number]["key"];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePermission("settings.manage");
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.some((item) => item.key === rawTab) ? (rawTab as Tab) : "general";
  const settings = await getSettings();

  let content: React.ReactNode;
  if (tab === "appearance") {
    content = (
      <AppearanceForm
        initial={{
          backgroundColor: settings.backgroundColor,
          cardColor: settings.cardColor,
          sidebarColor: settings.sidebarColor,
          primaryColor: settings.primaryColor,
        }}
      />
    );
  } else if (tab === "logo") {
    const [logo, fallback, sampleQr] = await Promise.all([
      getLogo(),
      defaultLogo(),
      qrPngDataUrl(`${appBaseUrl()}/r/apercu-du-logo`),
    ]);
    const pick = (value: typeof logo) => ({ dataUrl: value?.dataUrl ?? "", width: value?.width ?? 1, height: value?.height ?? 1 });
    content = (
      <LogoForm
        initial={{ logo: pick(logo), custom: logo?.custom ?? false }}
        defaultLogo={pick(fallback)}
        qrLogoEnabled={settings.qrLogoEnabled}
        sampleQr={sampleQr}
      />
    );
  } else if (tab === "structures") {
    const structures = await prisma.structure.findMany({ orderBy: [{ internal: "desc" }, { name: "asc" }] });
    content = <StructuresManager structures={structures} domains={internalEmailDomains()} />;
  } else if (tab === "types") {
    const [types, usage] = await Promise.all([
      listMeetingTypes(),
      prisma.meeting.groupBy({ by: ["type"], _count: { _all: true } }),
    ]);
    const counts = Object.fromEntries(usage.map((row) => [row.type, row._count._all]));
    content = <MeetingTypesManager types={types.map((type) => ({ ...type, usage: counts[type.code] ?? 0 }))} />;
  } else {
    content = (
      <Card>
        <SettingsForm settings={{ ...settings, publicBaseUrl: appBaseUrl() }} />
      </Card>
    );
  }

  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Organisation, apparence, logo, types de réunion et structures." />
      <nav className="mb-6 flex flex-wrap gap-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <Link
            key={key}
            href={`/settings?tab=${key}`}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
              tab === key ? "bg-primary text-white shadow-sm" : "border border-line bg-paper text-ink hover:bg-mint",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      {content}
    </div>
  );
}
