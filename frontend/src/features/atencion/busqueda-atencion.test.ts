import { describe, expect, it } from "vitest";
import { referenciaQr } from "./busqueda-atencion";

const id = "8023a72e-621d-4352-a6fa-53bc70cfb753";

describe("Referencia de atención", () => {
  it("acepta el UUID y los enlaces del vale", () => {
    expect(referenciaQr(" " + id + " ")).toBe(id);
    expect(referenciaQr("https://vales.example/vales/q/" + id)).toBe(id);
    expect(referenciaQr("/vales/q/" + id + "/documento")).toBe(id);
  });

  it("rechaza texto ajeno que contiene un UUID", () => {
    expect(referenciaQr("https://vales.example/otro/" + id)).toBeUndefined();
    expect(referenciaQr("Código " + id)).toBeUndefined();
    expect(referenciaQr("mailto:/vales/q/" + id)).toBeUndefined();
  });
});
