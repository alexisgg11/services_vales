import { describe, expect, it } from "vitest";
import { puedeAutorizarVale } from "./permisos";
const roles = (nombres: string[]) =>
  nombres.map((codigo_rol) => ({
    codigo_rol,
    cod_zonal: null,
    cod_proveedor: null,
  }));
describe("Autorización de un vale desde Jefatura", () => {
  const jefatura = {
    actor: 10,
    roles: [{ codigo_rol: "JEFE", cod_zonal: "01", cod_proveedor: null }],
  };
  const emitido = { estado_vale: 0, registrado_por: 1, cod_zonal: "01" };

  it("permite un vale pendiente de otro usuario en su zonal", () => {
    expect(puedeAutorizarVale(jefatura, emitido)).toBe(true);
  });

  it.each([
    { registrado_por: 10 },
    { cod_zonal: "02" },
    { estado_vale: 1 },
    { estado_vale: 4 },
  ])("excluye un vale con %j", (cambio) => {
    expect(puedeAutorizarVale(jefatura, { ...emitido, ...cambio })).toBe(false);
  });

  it("excluye a un perfil que carece de la función de Jefatura", () => {
    const operativo = { ...jefatura, roles: roles(["OPERATIVO"]) };
    expect(puedeAutorizarVale(operativo, emitido)).toBe(false);
  });
});
