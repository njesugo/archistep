import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTENT_SECURITY_POLICY } from "../csp";

const directive = (name: string) =>
  CONTENT_SECURITY_POLICY.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";

describe("politique de sécurité du contenu", () => {
  it("n'autorise de connexion qu'au site et à l'API d'Anthropic", () => {
    expect(directive("connect-src")).toBe("connect-src 'self' https://api.anthropic.com");
  });

  it("interdit les scripts extérieurs ou en ligne, les objets et les formulaires", () => {
    expect(directive("script-src")).toBe("script-src 'self'");
    expect(directive("object-src")).toBe("object-src 'none'");
    expect(directive("form-action")).toBe("form-action 'none'");
    expect(directive("default-src")).toBe("default-src 'self'");
  });

  it("n'ouvre rien d'autre que ce dont l'application a besoin", () => {
    expect(CONTENT_SECURITY_POLICY).not.toContain("unsafe-eval");
    expect(directive("script-src")).not.toContain("unsafe-inline");
    expect(directive("font-src")).toBe("font-src https://fonts.gstatic.com");
    expect(directive("img-src")).toBe("img-src 'self' data: blob:");
  });

  it("autorise les polices de l'application (celles de index.html)", () => {
    const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    const hosts = [...html.matchAll(/https:\/\/([a-z.]+)/g)].map((m) => m[1]);
    for (const host of new Set(hosts)) {
      expect(CONTENT_SECURITY_POLICY, host).toContain(`https://${host}`);
    }
  });
});
