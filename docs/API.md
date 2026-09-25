# API

Spécification OpenAPI : `docs/openapi.yaml`.

## Authentification back-office

Session Auth.js (cookie). Les routes `/api/meetings*` exigent un rôle habilité. La disparition d’un bouton n’est jamais une sécurité.

## Exemples

```
GET    /api/meetings
POST   /api/meetings
GET    /api/meetings/{id}
PATCH  /api/meetings/{id}

GET    /api/meetings/{id}/attendances
POST   /api/meetings/{id}/attendances

POST   /api/meetings/{id}/open
POST   /api/meetings/{id}/close
POST   /api/meetings/{id}/reopen

GET    /api/meetings/{id}/qr
GET    /api/meetings/{id}/exports/pdf
GET    /api/meetings/{id}/exports/xlsx
GET    /api/meetings/{id}/exports/csv
GET    /api/meetings/{id}/stream

POST   /api/public/meetings/{token}/attendance
GET    /api/health
```

La route publique est protégée par rate limiting et résolution du jeton hashé.
