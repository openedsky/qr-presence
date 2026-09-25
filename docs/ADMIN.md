# Manuel administrateur

Le super administrateur configure l’organisation, les utilisateurs, les rôles, les modèles, l’audit et la sécurité.

## Comptes

Créer les comptes depuis **Utilisateurs**. Rôles : SUPER_ADMIN, MEETING_ADMIN, ORGANIZER, SECRETARY, AUDITOR, USER.

## Paramètres

- URL publique (`https://presence.sodefor.ci`)
- Durée de conservation
- QR dynamique
- Rate limit
- Mention d’information RGPD / données personnelles

## Réouverture

Une réunion clôturée peut être réouverte. L’action est journalisée.

## Documents

Chaque liste officielle reçoit un UUID, un SHA-256, une date, un auteur. Vérification : `/verify/{documentId}` — sans liste nominative.
