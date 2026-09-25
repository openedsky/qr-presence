# Plan et résultats de tests

## Unitaires (Vitest)

- Normalisation téléphone ivoirien / international
- Normalisation email et clé nom/prénom
- Génération / hash de jeton
- Transitions de statut

```bash
npm test
```

## E2E (Playwright)

Scénario cible du cahier des charges :

Créer réunion → ouvrir → QR → formulaire → signer → enregistrer → présence → clôturer → PDF

```bash
npm run test:e2e
```

## Test de fumée HTTP (instance déployée)

```bash
BASE_URL=https://presence.sodefor.ci npm run test:smoke
# SMOKE_CLOSE=1 ajoute clôture puis réouverture de la réunion de démonstration
```

Ce test déroule les critères de recette sur l'instance réelle. Le rate limiting (20 soumissions par minute et par IP) peut répondre 429 si le test est relancé plusieurs fois dans la même minute : c'est le comportement attendu.

### Résultats du 24/09/2026 (image Docker de production, MariaDB 11.4, Redis 7, SeaweedFS)

| Contrôle | Résultat |
| --- | --- |
| Santé applicative (MariaDB, Redis) | OK |
| Formulaire public accessible | OK |
| API sans session : 401 | OK |
| Présence enregistrée avec signature stockée en S3 | OK |
| Double soumission rejetée | OK |
| Même email : alerte doublon | OK |
| 5 soumissions simultanées : une seule acceptée (contrainte base) | OK |
| Connexion administrateur, tableau de bord | OK |
| Participant visible côté administration | OK |
| PDF (signatures intégrées), Excel, CSV | OK |
| Clôture : QR inutilisable (404) | OK |
| Réouverture : QR imprimé de nouveau valide | OK |

Tests unitaires : 12 sur 12 réussis.

## Recette majeure

| Test | Attendu |
| --- | --- |
| Créer réunion | Réunion créée |
| Générer QR | URL `/r/{token}` |
| Scanner Android / iPhone | Formulaire accessible |
| Signer | Fichier objet + hash |
| Soumettre | Présence ACTIVE |
| Double soumission | Rejet |
| Même email | Alerte doublon |
| Dashboard | Apparition temps réel |
| Clôturer | QR inutilisable |
| PDF / Excel | Fichiers valides |
| Modifier présence | Historique |
| Annuler | Soft delete |
| QR expiré | Refus explicite |
| Sans droit | 403 |
