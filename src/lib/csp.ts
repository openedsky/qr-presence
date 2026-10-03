/**
 * Politique de sécurité du contenu : seuls les scripts portant le nonce de la requête (ceux de Next.js)
 * s'exécutent ; un script injecté dans la page est bloqué. Les styles en ligne restent permis (attributs style).
 */
export function contentSecurityPolicy(nonce: string, isDev = process.env.NODE_ENV !== "production") {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "frame-src 'self' blob:",
    "object-src 'self' blob:",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; ");
}