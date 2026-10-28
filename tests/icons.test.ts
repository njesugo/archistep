import { describe, expect, it } from "vitest";
import {
  buildLogoTable,
  iconSource,
  parseLogoFilename,
  simpleIconsSlug,
} from "../src/icons/resolve";

describe("noms de fichiers de logos", () => {
  it("déduit la clé du nom de fichier", () => {
    expect(parseLogoFilename("/src/assets/logos/airflow.svg")).toEqual({
      key: "airflow",
      dark: false,
    });
    expect(parseLogoFilename("dbt.PNG")).toEqual({ key: "dbt", dark: false });
  });

  it("reconnaît la variante .dark", () => {
    expect(parseLogoFilename("/x/airflow.dark.svg")).toEqual({ key: "airflow", dark: true });
  });

  it("ignore ce qui n'est pas un logo", () => {
    expect(parseLogoFilename("README.md")).toBeNull();
    expect(parseLogoFilename("logo.gif")).toBeNull();
  });
});

describe("table des logos", () => {
  it("associe clair et sombre à la même clé", () => {
    const table = buildLogoTable({
      "/l/airflow.svg": "/a.svg",
      "/l/airflow.dark.svg": "/a-dark.svg",
      "/l/dbt.png": "/d.png",
    });
    expect(table.get("airflow")).toEqual({ url: "/a.svg", darkUrl: "/a-dark.svg" });
    expect(table.get("dbt")).toEqual({ url: "/d.png" });
  });

  it("n'utilise pas une variante .dark seule", () => {
    expect(buildLogoTable({ "/l/dbt.dark.svg": "/d.svg" }).size).toBe(0);
  });
});

describe("ordre de résolution", () => {
  const logos = buildLogoTable({ "/l/youtube.svg": "/y.svg" });
  const simple = new Set(["youtube", "databricks", "apacheairflow"]);

  it("préfère le fichier fourni à simple-icons", () => {
    expect(iconSource("youtube", logos, simple)).toBe("user");
    expect(iconSource("YouTube", logos, simple)).toBe("user");
  });

  it("se rabat sur simple-icons, y compris par alias", () => {
    expect(iconSource("databricks", logos, simple)).toBe("simple-icons");
    expect(iconSource("airflow", logos, simple)).toBe("simple-icons");
    expect(simpleIconsSlug("airflow")).toBe("apacheairflow");
  });

  it("finit sur l'icône générique", () => {
    expect(iconSource("dbt", logos, simple)).toBe("generic");
    expect(iconSource(undefined, logos, simple)).toBe("generic");
  });
});
