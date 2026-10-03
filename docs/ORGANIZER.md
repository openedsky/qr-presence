# Manuel organisateur

## Parcours

1. Créer la réunion (objet, dates, lieu ou visio).
2. Planifier puis ouvrir les inscriptions.
3. Afficher / imprimer le QR (salle, convocation, vidéoprojecteur).
4. Suivre les présences en temps réel.
5. Corriger ou ajouter manuellement si besoin.
6. Clôturer : confirmation obligatoire. La liste officielle (version 1) est établie automatiquement.
7. Exporter la liste officielle (PDF) et Excel.

## Liste provisoire, liste officielle et corrections

- Avant la clôture, le PDF est une **liste provisoire** (filigrane « PROVISOIRE ») qui ne fait pas foi.
- À la clôture, les informations de la réunion sont **gelées** et la **liste officielle v1** est établie, avec un QR de vérification.
- Après la clôture, ajouter, corriger ou annuler une présence exige un **motif**. Le PDF officiel suivant devient la **version 2**, avec la mention « annule et remplace la version 1 » et les motifs. La page de vérification signale toute version remplacée.
- Seul un super administrateur peut rouvrir une réunion clôturée. Une réunion archivée n’est plus modifiable.

## Droits par réunion

Un organisateur ne voit, ne modifie et n’exporte que **ses** réunions ; son tableau de bord et ses statistiques sont limités à celles-ci. Les signatures et documents ne sont servis qu’aux comptes autorisés sur la réunion concernée.

## Champs obligatoires

Les champs marqués d’un astérisque rouge **\*** sont obligatoires : objet, type, date, heure de début, tolérance, mode et niveau de sécurité QR. Le lieu est obligatoire sauf si un lien de visioconférence est renseigné (réunion distante).

## Imprimer le QR code

Réunion → onglet **QR Code** → **Télécharger pour impression (A4)**. L’affiche PDF reprend le modèle institutionnel : logo, Ministère des Eaux et Forêts, objet, lieu, date, QR code, mention « SCANNEZ LE QRCODE POUR VOUS INSCRIRE » et adresse d’inscription. Seul le QR **statique** est imprimable ; le QR dynamique se renouvelle et doit être affiché à l’écran.

En mode **dynamique**, une affiche statique imprimée n’est pas acceptée. Le participant scanne le QR affiché à l’écran, puis dispose de **15 minutes** pour remplir et signer ; cette session ne sert qu’à une seule personne.

Après la clôture, scanner l’affiche indique « réunion clôturée » et donne accès à la liste publique si elle est activée. Avant l’ouverture, la page indique la date d’ouverture de l’émargement.

## Réunion réservée aux agents

Si « invités externes » est désactivé, le participant choisit sa structure dans la liste des structures **internes** (référentiel des structures) ; une adresse email du domaine de l’organisation (`INTERNAL_EMAIL_DOMAINS`, par défaut `sodefor.ci`) est également acceptée. Les autres sont refusés. L’ajout manuel par un organisateur reste possible.

## Calendrier

Menu **Calendrier** : vue mensuelle des réunions prévues (bleu), en cours (vert) et achevées (gris), avec filtres et détail de la journée sélectionnée.

## Confidentialité

N’activez « liste publique » que si les participants peuvent voir nom, fonction, structure et heure — jamais email, téléphone ou signature.

## Doublons

Une seconde soumission avec le même email, téléphone ou compte interne est refusée, avec un message neutre qui ne révèle rien du participant déjà inscrit. L’enregistrement initial n’est pas écrasé.

Deux personnes portant le **même nom** mais un email ou un téléphone différents sont toutes deux acceptées (homonymes) : la seconde est marquée **« Homonyme à vérifier »**. Depuis sa fiche, confirmez « Ce sont deux personnes » ou annulez la présence s’il s’agit d’un doublon. Sans email ni téléphone, un même nom reste refusé.

## Ajout manuel

Mode **saisie administrateur**, distinct du scan QR. Utile sans smartphone ou hors réseau. L’email n’y est jamais obligatoire ; la saisie est tracée.

## Limite anti-abus

Les envois publics sont limités par appareil, par adresse IP réelle (lue via le proxy de confiance, `TRUSTED_PROXY_HOPS`) et par réunion, avec des plafonds proportionnés à l’effectif attendu : renseignez « participants attendus » pour les grandes réunions.
