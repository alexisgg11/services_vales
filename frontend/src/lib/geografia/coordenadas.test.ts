import { describe, expect, it } from "vitest";
import { mostrarDistancia, origenValido } from "./coordenadas";

describe("Coordenadas geográficas", () => {
  it("acepta coordenadas de los límites geográficos", () => {
    expect(origenValido({ latitud: -90, longitud: 180 })).toBe(true);
    expect(origenValido({ latitud: 90, longitud: -180 })).toBe(true);
  });

  it.each([
    { latitud: -91, longitud: 180 },
    { latitud: 0, longitud: 181 },
    { latitud: NaN, longitud: 0 },
    { latitud: 0, longitud: Infinity },
  ])("rechaza el punto $latitud, $longitud", (punto) => {
    expect(origenValido(punto)).toBe(false);
  });

  it("formatea distancias viales para el mapa", () => {
    expect(mostrarDistancia(null)).toBe("Sin distancia");
    expect(mostrarDistancia(0.354)).toBe("354 m");
    expect(mostrarDistancia(1.234)).toBe("1.23 km");
  });
});
