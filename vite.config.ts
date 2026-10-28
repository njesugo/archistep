/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { CONTENT_SECURITY_POLICY } from "./csp";

/** Ajoute la CSP à la page construite (pas au serveur de développement, qui a besoin de scripts en ligne). */
function contentSecurityPolicy(): Plugin {
  return {
    name: "content-security-policy",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler: (html) =>
        html.replace(
          "<head>",
          `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`,
        ),
    },
  };
}

export default defineConfig({
  plugins: [react(), contentSecurityPolicy()],
  test: { include: ["tests/**/*.test.{ts,tsx}"], environment: "node" },
});
