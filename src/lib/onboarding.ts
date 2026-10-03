import type { Permission } from "./rbac";

export type TourStep = {
  id: string;
  /** Valeur de l'attribut `data-tour` de l'élément mis en surbrillance ; absente : carte centrée. */
  target?: string;
  title: string;
  text: string;
};

type StepDefinition = TourStep & { anyOf?: Permission[]; noneOf?: Permission[] };

/** Événement qui relance la visite guidée (menu utilisateur). */
export const START_TOUR_EVENT = "sodefor:start-tour";

const STEPS: StepDefinition[] = [
  {
    id: "welcome",
    title: "Bienvenue sur SODEFOR Présences",
    text: "Cette courte visite présente l'essentiel : organiser une réunion, faire émarger les participants par QR code et retrouver les listes de présence. Comptez une minute.",
  },
  {
    id: "dashboard",
    target: "/dashboard",
    title: "Tableau de bord",
    text: "Vue d'ensemble : réunions du jour, émargements en direct et réunions à clôturer. C'est votre page d'accueil.",
  },
  {
    id: "meetings-create",
    target: "/meetings",
    title: "Réunions",
    text: "Créez une réunion (objet, date, lieu, niveau de sécurité du QR), puis faites-la passer de « brouillon » à « planifiée » et « ouverte ». À la clôture, la liste officielle signée est établie automatiquement.",
    anyOf: ["meetings.create"],
  },
  {
    id: "meetings-read",
    target: "/meetings",
    title: "Réunions",
    text: "Retrouvez ici les réunions qui vous concernent : participants, documents et historique de chacune.",
    noneOf: ["meetings.create"],
  },
  {
    id: "qr",
    title: "QR code et émargement",
    text: "Chaque réunion a son QR : statique (affiche imprimable) ou dynamique (renouvelé à l'écran de la salle). Les participants le scannent et signent sur leur téléphone, uniquement pendant la fenêtre d'émargement ; la réunion est ensuite clôturée automatiquement.",
    anyOf: ["qr.display"],
  },
  {
    id: "calendar",
    target: "/calendar",
    title: "Calendrier",
    text: "Toutes les réunions par mois : prévues, en cours et achevées, avec un filtre par état.",
  },
  {
    id: "statistics",
    target: "/statistics",
    title: "Statistiques",
    text: "Réunions tenues, présences, taux de participation et structures les plus représentées, par période.",
    anyOf: ["stats.read"],
  },
  {
    id: "admin-users",
    target: "/users",
    title: "Administration",
    text: "Gérez les comptes et leurs rôles, les modèles des documents PDF, les paramètres de l'organisation et consultez le journal d'audit.",
    anyOf: ["users.manage"],
  },
  {
    id: "admin-other",
    target: "/settings",
    title: "Administration",
    text: "Modèles des documents PDF, paramètres de l'organisation et journaux : tout se règle depuis cette section.",
    anyOf: ["settings.manage"],
    noneOf: ["users.manage"],
  },
  {
    id: "documents",
    target: "/documents",
    title: "Modèles de documents",
    text: "Personnalisez les modèles des listes de présence PDF (en-têtes, mentions, colonnes) et prévisualisez le rendu.",
    anyOf: ["documents.manage"],
    noneOf: ["users.manage", "settings.manage"],
  },
  {
    id: "audit",
    target: "/audit",
    title: "Journal d'audit",
    text: "Chaque action est tracée : auteur, date, valeurs avant et après. Filtrez par période, objet ou utilisateur.",
    anyOf: ["audit.read"],
    noneOf: ["users.manage", "settings.manage"],
  },
  {
    id: "user-menu",
    target: "user-menu",
    title: "Votre compte",
    text: "Votre profil, votre mot de passe, votre historique de connexions, et « Revoir le didacticiel » pour relancer cette visite à tout moment.",
  },
  {
    id: "done",
    title: "Vous êtes prêt",
    text: "Bonne utilisation ! En cas de doute, chaque écran rappelle les règles applicables (fenêtre d'émargement, clôture, liste officielle).",
  },
];

/** Étapes de la visite selon les droits de l'utilisateur. */
export function tourSteps(permissions: readonly Permission[]): TourStep[] {
  const has = (permission: Permission) => permissions.includes(permission);
  return STEPS.filter(
    (step) => (!step.anyOf || step.anyOf.some(has)) && (!step.noneOf || !step.noneOf.some(has)),
  ).map((step) => ({ id: step.id, target: step.target, title: step.title, text: step.text }));
}
