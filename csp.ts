// Politique de sécurité du contenu : la page ne peut contacter que son propre site et l'API
// d'Anthropic (génération de spec par IA avec la clé de l'utilisateur, gardée dans le navigateur).
// Une clé volée par un script injecté n'aurait nulle part où partir.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  // Les styles en ligne viennent des attributs `style` de React ; les polices, de Google Fonts.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  // blob: pour les vignettes d'images collées, data: pour les petites images intégrées.
  "img-src 'self' data: blob:",
  "connect-src 'self' https://api.anthropic.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");
