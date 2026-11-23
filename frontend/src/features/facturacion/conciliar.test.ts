import { describe, it, expect } from "vitest";
import {
  cambiosDeSeleccion,
  conciliar,
  optimizarAsociacion,
  sugerirFacturas,
} from "./conciliar";
import type { Factura, Vale } from "@/lib/types";
const vale = (id: string, ticket: string, importe: number) =>
  ({
    id_vale: id,
    ticket,
    importe,
    cod_proveedor: "20000000001",
    estado_vale: 3,
    codigo_factura: null,
  }) as Vale;
const factura = {
  codigo_factura: "1",
  cod_proveedor: "20000000001",
  tickets: ["T1", "T2"],
  total: 30.3,
} as Factura;
describe("Conciliación de vales y factura", () => {
  it("rechaza tickets equivocados aunque la suma coincida", () => {
    expect(
      conciliar(factura, [vale("1", "T3", 10.1), vale("2", "T4", 20.2)]).listo,
    ).toBe(false);
  });
  it("acepta el conjunto exacto de tickets con redondeo monetario", () => {
    expect(
      conciliar(factura, [vale("2", "T2", 20.2), vale("1", "T1", 10.1)]).listo,
    ).toBe(true);
  });
  it("rechaza otro proveedor y un vale que ya tiene factura", () => {
    expect(
      conciliar(factura, [
        { ...vale("1", "T1", 10.1), cod_proveedor: "20000000002" },
        vale("2", "T2", 20.2),
      ]).listo,
    ).toBe(false);
    expect(
      conciliar(factura, [
        { ...vale("1", "T1", 10.1), codigo_factura: "9" },
        vale("2", "T2", 20.2),
      ]).listo,
    ).toBe(false);
  });
  it("separa los tickets que coinciden, faltan y sobran", () => {
    const sobrante = vale("3", "T3", 20.2);
    expect(conciliar(factura, [vale("1", "T1", 10.1), sobrante])).toMatchObject(
      {
        coincidentes: ["T1"],
        faltantes: ["T2"],
        sobrantes: [sobrante],
        diferencia: 0,
        listo: false,
      },
    );
  });
  it("conserva la diferencia de un céntimo con los mismos tickets", () => {
    const r = conciliar({ ...factura, total: 30.31 }, [
      vale("1", "T1", 10.1),
      vale("2", "T2", 20.2),
    ]);
    expect(r).toMatchObject({ tickets: true, diferencia: -0.01, listo: false });
  });
});

describe("Sugerencias de conciliación", () => {
  it("prioriza la coincidencia exacta y excluye otro grifo o una factura asociada", () => {
    const vales = [vale("1", "T1", 10.1), vale("2", "T2", 20.2)];
    expect(
      sugerirFacturas(
        [
          { ...factura, codigo_factura: "2", total: 30.31 },
          { ...factura, codigo_factura: "3", tickets: ["T1", "T3"] },
          { ...factura, codigo_factura: "4", cod_proveedor: "20000000002" },
          { ...factura, codigo_factura: "5", asociado_por: 20 },
          { ...factura, codigo_factura: "6", tickets: ["T3", "T4"] },
          factura,
        ],
        vales,
      ).map(({ factura }) => factura.codigo_factura),
    ).toEqual(["1", "2", "3"]);
  });
  it("propone agregar y quitar vales sin modificar la selección", () => {
    const faltante = vale("2", "T2", 20.2);
    const extra = vale("3", "T3", 20.2);
    const lote = [vale("1", "T1", 10.1), extra];
    expect(
      cambiosDeSeleccion(factura, conciliar(factura, lote), [faltante]),
    ).toEqual({ agregar: [faltante], quitar: [extra], sinVale: [] });
    expect(lote.map((v) => v.id_vale)).toEqual(["1", "3"]);
  });
  it("detecta un ticket sin vale elegible para el grifo", () => {
    const resultado = conciliar(factura, [vale("1", "T1", 10.1)]);
    const otro = { ...vale("2", "T2", 20.2), cod_proveedor: "20000000002" };
    const asociado = { ...vale("3", "T2", 20.2), codigo_factura: "8" };
    expect(cambiosDeSeleccion(factura, resultado, [otro, asociado])).toEqual({
      agregar: [],
      quitar: [],
      sinVale: ["T2"],
    });
  });
});

describe("Optimizar asociación", () => {
  const primero = vale("1", "T1", 10.1);
  const segundo = vale("2", "T2", 20.2);
  const otro = vale("3", "T3", 20.2);
  const pendientes = [primero, segundo, otro];

  it("corrige una factura elegida con un céntimo de diferencia", () => {
    const incorrecta = { ...factura, codigo_factura: "2", total: 30.31 };
    expect(
      optimizarAsociacion(
        [incorrecta, factura],
        [primero, segundo],
        pendientes,
        incorrecta.codigo_factura,
      ),
    ).toEqual({ estado: "encontrada", factura, vales: [primero, segundo] });
  });

  it("completa los tickets pendientes y retira los sobrantes", () => {
    const seleccion = [primero, otro];
    expect(optimizarAsociacion([factura], seleccion, pendientes)).toEqual({
      estado: "encontrada",
      factura,
      vales: [primero, segundo],
    });
    expect(seleccion).toEqual([primero, otro]);
  });

  it("pide elegir entre facturas igual de válidas y respeta la elegida", () => {
    const duplicada = { ...factura, codigo_factura: "2" };
    expect(
      optimizarAsociacion([factura, duplicada], [primero], pendientes),
    ).toEqual({ estado: "varias-coincidencias" });
    expect(
      optimizarAsociacion(
        [factura, duplicada],
        [primero],
        pendientes,
        duplicada.codigo_factura,
      ),
    ).toEqual({
      estado: "encontrada",
      factura: duplicada,
      vales: [primero, segundo],
    });
  });

  it("omite facturas con tickets agotados, ajenos al lote o importes distintos", () => {
    expect(
      optimizarAsociacion(
        [
          factura,
          { ...factura, codigo_factura: "2", tickets: ["T3"], total: 20.2 },
          { ...factura, codigo_factura: "3", tickets: ["T1"], total: 10.11 },
        ],
        [primero],
        [primero, { ...segundo, codigo_factura: "8" }, otro],
      ),
    ).toEqual({ estado: "sin-coincidencia" });
  });
});
