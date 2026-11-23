import { describe, it, expect } from "vitest";
import { condiciones, unidades } from "./condiciones";
import type { Cuenta } from "@/lib/types";
const c = {
  trabajador: { zonal: "01" },
  contratos: [
    {
      id: "C1",
      proveedor: "P1",
      inicio: "2026-01-01",
      fin: "2026-12-31",
      activo: true,
      saldo: 100,
      precios: { D: 20 },
    },
    {
      id: "C2",
      proveedor: "P2",
      inicio: "2025-01-01",
      fin: "2025-12-31",
      activo: true,
      saldo: 100,
      precios: { D: 18 },
    },
  ],
  tarifas: [
    { proveedor: "P1", suministro: "D", inicio: "2026-01-01", precio: 21 },
    { proveedor: "P2", suministro: "D", inicio: "2026-01-01", precio: 22 },
  ],
  maquinaria: [
    {
      codigo: 1,
      cod_zonal: "04",
      placa: "DEM-202",
      habilitaciones: [
        { zonal: "01", centro: "C1", desde: "2026-11-01", hasta: "2026-11-30" },
      ],
    },
    { codigo: 2, cod_zonal: "01", placa: "DEM-101", habilitaciones: [] },
  ],
} as unknown as Cuenta;
describe("Filtros de emisión", () => {
  it("exige contrato vencido y ninguno vigente para S/C del trabajador", () => {
    expect(
      Object.keys(condiciones(c, "P1", "2026-11-21", "SC_TRABAJADOR").precios),
    ).toHaveLength(0);
    expect(condiciones(c, "P2", "2026-11-21", "SC_TRABAJADOR").precios).toEqual(
      { D: 22 },
    );
  });
  it("muestra unidades propias primero y exige trabajo y fecha del préstamo", () => {
    expect(unidades(c, "C1", "2026-11-21").map((u) => u.codigo)).toEqual([
      2, 1,
    ]);
    expect(unidades(c, "C2", "2026-11-21").map((u) => u.codigo)).toEqual([2]);
    expect(unidades(c, "C1", "2026-12-01").map((u) => u.codigo)).toEqual([2]);
  });
});
