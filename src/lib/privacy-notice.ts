/** Ancienne mention par défaut : si elle est encore en base, elle est remplacée par la mention conforme. */
export const LEGACY_PRIVACY_NOTICE =
  "Les informations collectées (identité, fonction, structure, coordonnées et signature) sont destinées exclusivement à l'établissement des listes de présence des réunions SODEFOR. Elles sont accessibles aux seuls agents habilités et ne sont pas publiées sur la page publique d'émargement.";

export const LEGACY_PRIVACY_NOTICES = [
  LEGACY_PRIVACY_NOTICE,
  "Les informations collectées (identité, fonction, structure, coordonnées et signature) sont destinées exclusivement à l'établissement des listes de présence des réunions SODEFOR. Elles sont accessibles aux seuls agents habilités, conservées pour la durée paramétrée, et ne sont pas publiées sur la page publique d'émargement.",
];

export const DEFAULT_PRIVACY_NOTICE = [
  "Responsable du traitement : SODEFOR (Société de Développement des Forêts), Abidjan, Côte d'Ivoire.",
  "Finalité : établir et conserver la liste de présence officielle de la réunion. Base légale : intérêt légitime de la SODEFOR à justifier la tenue de ses réunions.",
  "Données : nom, prénom, fonction, structure, coordonnées demandées, signature et heure d'émargement. Seuls les agents habilités y ont accès ; les coordonnées et la signature ne sont jamais publiées.",
  "Liste publique : lorsque l'organisateur l'active, vos nom, fonction et structure n'y apparaissent que si vous y consentez expressément.",
  "Conservation : les données sont anonymisées et les signatures supprimées à l'issue de la durée de conservation fixée par la SODEFOR ; les listes officielles signées sont archivées.",
  "Vos droits (loi n° 2013-450 du 19 juin 2013 relative à la protection des données à caractère personnel) : accès, rectification, opposition et suppression, auprès du correspondant données personnelles de la SODEFOR. Vous pouvez également saisir l'ARTCI (Autorité de Régulation des Télécommunications/TIC de Côte d'Ivoire).",
].join("\n");
