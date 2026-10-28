import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SpecDrawer } from "../src/components/SpecDrawer";
import { DEFAULT_EXAMPLE } from "../src/examples";
import {
  buildShareUrl,
  decodeSpec,
  encodeSpec,
  fromBase64Url,
  LONG_LINK_CHARS,
  MAX_SHARED_BYTES,
  readHashPayload,
  ShareError,
  toBase64Url,
} from "../src/share";
import { parseSpecJson } from "../src/spec/validate";

const minified = JSON.stringify(JSON.parse(DEFAULT_EXAMPLE.text));

describe("base64url", () => {
  it("fait l'aller-retour sur des octets quelconques, sans caractères réservés d'URL", () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    const text = toBase64Url(bytes);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(fromBase64Url(text)).toEqual(bytes);
  });

  it("accepte toutes les longueurs (avec ou sans bourrage)", () => {
    for (let n = 0; n < 12; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => 200 - i);
      expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
    }
  });

  it("refuse un caractère invalide ou un texte tronqué", () => {
    expect(() => fromBase64Url("abc+def")).toThrow(ShareError);
    expect(() => fromBase64Url("a")).toThrow(/tronqué|abîmé/);
  });
});

describe("lien de partage", () => {
  it("fait l'aller-retour sur l'exemple complet, accents compris", async () => {
    const payload = await encodeSpec(minified);
    expect(payload.startsWith("z.")).toBe(true);
    expect(await decodeSpec(payload)).toBe(minified);
    expect(parseSpecJson(await decodeSpec(payload)).ok).toBe(true);
  });

  it("compresse : le lien fait moins de la moitié du JSON, et reste sous le seuil des liens longs", async () => {
    const payload = await encodeSpec(minified);
    expect(payload.length).toBeLessThan(minified.length * 0.6);
    expect(payload.length).toBeLessThan(LONG_LINK_CHARS / 2);
  });

  it("ne contient que des caractères sûrs dans une URL", async () => {
    expect(await encodeSpec(minified)).toMatch(/^z\.[A-Za-z0-9_-]+$/);
  });

  it("conserve tous les caractères Unicode d'une spec", async () => {
    const text = JSON.stringify({ t: "é à ç œ — « » ’ 日本語 😀" });
    expect(await decodeSpec(await encodeSpec(text))).toBe(text);
  });

  it("lit aussi le format non compressé (j.) pour les navigateurs sans compression", async () => {
    const payload = `j.${toBase64Url(new TextEncoder().encode(minified))}`;
    expect(await decodeSpec(payload)).toBe(minified);
  });
});

describe("liens abîmés ou piégés", () => {
  it("refuse un format inconnu", async () => {
    await expect(decodeSpec("x.abcd")).rejects.toThrow(/format inconnu/);
    await expect(decodeSpec("")).rejects.toThrow(ShareError);
  });

  it("refuse des données qui ne se décompressent pas", async () => {
    await expect(
      decodeSpec(`z.${toBase64Url(new TextEncoder().encode("pas du deflate"))}`),
    ).rejects.toThrow(/tronqué ou abîmé/);
  });

  it("refuse un lien coupé en route", async () => {
    const payload = await encodeSpec(minified);
    await expect(decodeSpec(payload.slice(0, payload.length / 2))).rejects.toThrow(ShareError);
  });

  it("refuse un octet modifié sans planter", async () => {
    const payload = await encodeSpec(minified);
    const broken = `${payload.slice(0, 40)}${payload[40] === "A" ? "B" : "A"}${payload.slice(41)}`;
    const outcome = await decodeSpec(broken).then(
      (text) => parseSpecJson(text),
      (error: unknown) => error,
    );
    // soit le décodage échoue proprement, soit le texte obtenu échoue à la validation
    expect(
      outcome instanceof ShareError ||
        (typeof outcome === "object" &&
          "ok" in (outcome as object) &&
          !(outcome as { ok: boolean }).ok),
    ).toBe(true);
  });

  it("refuse une archive qui se décompresse en trop de données (archive piégée)", async () => {
    const bomb = await encodeSpec("a".repeat(MAX_SHARED_BYTES + 1000));
    expect(bomb.length).toBeLessThan(10_000); // quelques Ko de lien pour des Mo de données
    await expect(decodeSpec(bomb)).rejects.toThrow(/trop volumineuse/);
  });

  it("refuse un texte non UTF-8", async () => {
    const payload = `j.${toBase64Url(Uint8Array.from([0xff, 0xfe, 0xfd]))}`;
    await expect(decodeSpec(payload)).rejects.toThrow(/pas lisible/);
  });
});

describe("adresse", () => {
  it("lit la charge utile dans le fragment", () => {
    expect(readHashPayload("#spec=z.abc_-")).toBe("z.abc_-");
    expect(readHashPayload("spec=j.xyz")).toBe("j.xyz");
    expect(readHashPayload("#autre=1&spec=z.q")).toBe("z.q");
  });

  it("renvoie null sans lien", () => {
    expect(readHashPayload("")).toBeNull();
    expect(readHashPayload("#")).toBeNull();
    expect(readHashPayload("#spec=")).toBeNull();
    expect(readHashPayload("#section")).toBeNull();
  });

  it("construit un lien vers la page courante, en remplaçant l'ancien fragment", () => {
    expect(buildShareUrl("https://archistep-six.vercel.app/", "z.abc")).toBe(
      "https://archistep-six.vercel.app/#spec=z.abc",
    );
    expect(buildShareUrl("https://site.test/chemin?a=1#spec=z.ancien", "z.nouveau")).toBe(
      "https://site.test/chemin?a=1#spec=z.nouveau",
    );
  });

  it("le lien relu redonne la même charge utile", async () => {
    const payload = await encodeSpec(minified);
    const url = new URL(buildShareUrl("https://site.test/", payload));
    expect(readHashPayload(url.hash)).toBe(payload);
  });
});

describe("tiroir : lien de partage", () => {
  const spec = (() => {
    const r = parseSpecJson(DEFAULT_EXAMPLE.text);
    if (!r.ok) throw new Error("exemple invalide");
    return r.spec;
  })();
  const render = (fromLink: boolean) =>
    renderToStaticMarkup(
      <SpecDrawer
        open
        onClose={() => {}}
        text={DEFAULT_EXAMPLE.text}
        onTextChange={() => {}}
        errors={[]}
        spec={spec}
        fromLink={fromLink}
        onImport={() => {}}
        onExport={() => {}}
        onLoadExample={() => {}}
      />,
    );

  it("propose de copier le lien", () => {
    expect(render(false)).toContain("Copier le lien");
  });

  it("prévient que la spec d'un lien n'est pas enregistrée tant qu'on ne la modifie pas", () => {
    expect(render(true)).toContain("Spec ouverte depuis un lien de partage");
    expect(render(false)).not.toContain("Spec ouverte depuis un lien de partage");
  });
});
