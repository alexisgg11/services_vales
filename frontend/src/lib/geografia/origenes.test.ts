import { describe, expect, it } from "vitest";
import { origenLocalidad } from "./origenes";

const cuenta = {
  zonales: [
    { id_zona: "01", nom_zona: "PIURA" },
    { id_zona: "03", nom_zona: "PAITA" },
    { id_zona: "04", nom_zona: "SULLANA" },
  ],
  localidades: [
    { id_localidad: "operativo", id_zona: "01", nom_localidad: "Castilla" },
    { id_localidad: "tercero", id_zona: "03", nom_localidad: "COLÁN" },
    { id_localidad: "sede", id_zona: "01", nom_localidad: "SEDE CENTRAL" },
    { id_localidad: "zonal", id_zona: "04", nom_localidad: "ZONAL SULLANA" },
    { id_localidad: "nueva", id_zona: "01", nom_localidad: "Localidad nueva" },
    { id_localidad: "homonimo", id_zona: "04", nom_localidad: "MIRAMAR" },
  ],
};

describe("Origen de referencia para comparar grifos", () => {
  it("usa la localidad asignada por nombre y zonal, sin depender de códigos de prueba ni GPS", () => {
    const origen = origenLocalidad(cuenta, "operativo");
    expect(origen).toMatchObject({
      nombre: "Castilla",
      fuente: "localidad",
      localidad: "operativo",
    });
    expect(origen!.latitud).toBeLessThan(-5);
    expect(origen!.longitud).toBeLessThan(-80);
  });
  it("permite otro origen para un tercero y conserva la asignación administrativa", () => {
    const antes = structuredClone(cuenta);
    const operativo = origenLocalidad(cuenta, "operativo");
    const tercero = origenLocalidad(cuenta, "tercero");
    expect(tercero?.nombre).toBe("COLÁN");
    expect(tercero?.longitud).not.toBe(operativo?.longitud);
    expect(cuenta).toEqual(antes);
  });
  it("resuelve referencias de sede y zonal sin inventar coordenadas para localidades nuevas u homónimas", () => {
    expect(origenLocalidad(cuenta, "sede")?.nombre).toBe("SEDE CENTRAL");
    expect(origenLocalidad(cuenta, "zonal")?.latitud).toBeGreaterThan(-5);
    expect(origenLocalidad(cuenta, "nueva")).toBeUndefined();
    expect(origenLocalidad(cuenta, "homonimo")).toBeUndefined();
    expect(origenLocalidad(cuenta, "inexistente")).toBeUndefined();
  });
});
