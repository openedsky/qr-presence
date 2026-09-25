import { requirePermission } from "@/lib/guards";
import { Card, PageHeader } from "@/components/ui";

export default async function DocumentsPage() {
  await requirePermission("documents.manage");
  return (
    <div>
      <PageHeader title="Modèles PDF" subtitle="En-tête institutionnel, tableau officiel et pied de page authentifié." />
      <Card>
        <ul className="space-y-3 text-sm text-muted">
          <li>Liste officielle : Ministère, logo SODEFOR, objet, lieu, date, signatures, QR de vérification.</li>
          <li>Liste publique : nom, fonction, structure, heure — sans email, téléphone ni signature.</li>
          <li>Affiche QR : objet, lieu, date, instruction de scan.</li>
        </ul>
      </Card>
    </div>
  );
}
