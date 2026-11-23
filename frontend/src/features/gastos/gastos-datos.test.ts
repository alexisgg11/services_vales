import { describe, expect, it } from "vitest";
import type { Vale } from "@/lib/types";
import {
  agruparGastos,
  esConsumoFacturado,
  filtrarGastos,
  rangoPeriodo,
  resumirGastos,
  type ConsumoFacturado,
  type FiltrosGastos,
} from "./gastos-datos";
import { csvGastos } from "./gastos-exportacion";

const usado = {
  id_vale: "1",
  codigo_vale: "2025120001",
  estado_vale: 3,
  cod_zonal: "10",
  zonal: "Piura",
  id_suministro: "D",
  suministro: "Diésel B5",
  cod_proveedor: "20000000001",
  grifo: "Los Algarrobos",
  cod_centrocosto: "100",
  centro_costo: "Mantenimiento",
  fecha_consumo: "2025-12-29",
  importe: 0.1,
  cantidad_consumida: 0.1,
  nrocontrato: "DEMO-A",
  codigo_factura: "1",
  factura_numero: "F001-00000001",
  ticket: "T00000000000001",
} as ConsumoFacturado;

describe("Consultar gastos", () => {
  it("incluye los consumos facturados y aplica todos los filtros por fecha de despacho", () => {
    const sinFactura: Vale = {
      ...usado,
      id_vale: "2",
      codigo_factura: null,
      factura_numero: null,
    };
    const emitido: Vale = { ...usado, id_vale: "3", estado_vale: 0 };
    const otraZonal = { ...usado, id_vale: "4", cod_zonal: "20" };
    const otroCentro = { ...usado, id_vale: "5", cod_centrocosto: "200" };
    const sc = { ...usado, id_vale: "6", nrocontrato: null };
    const fuera = { ...usado, id_vale: "7", fecha_consumo: "2025-12-28" };
    const otroGrifo = { ...usado, id_vale: "8", cod_proveedor: "20000000002" };
    const otroSuministro = { ...usado, id_vale: "9", id_suministro: "G" };
    const filtros: FiltrosGastos = {
      periodo: "personalizado",
      desde: "2025-12-29",
      hasta: "2025-12-29",
      zonal: "10",
      suministro: "D",
      modalidad: "Con contrato",
      grifo: "20000000001",
      centro: "100",
    };
    const vales = [
      usado,
      sinFactura,
      emitido,
      otraZonal,
      otroCentro,
      sc,
      fuera,
      otroGrifo,
      otroSuministro,
    ];
    expect(filtrarGastos(vales.filter(esConsumoFacturado), filtros)).toEqual([
      usado,
    ]);
  });

  it("cierra las semanas el domingo y conserva la separación por combustible, mes y año", () => {
    const domingo = {
      ...usado,
      id_vale: "2",
      fecha_consumo: "2026-01-04",
      importe: 0.2,
      cantidad_consumida: 0.2,
    };
    const lunes = { ...usado, id_vale: "3", fecha_consumo: "2026-01-05" };
    const gasolina = {
      ...domingo,
      id_vale: "4",
      suministro: "Gasolina regular",
      id_suministro: "G",
    };
    const vales = [usado, domingo, lunes, gasolina];
    const semanas = agruparGastos(vales, "semana");
    expect(semanas.map((semana) => semana.inicio)).toEqual([
      "2025-12-29",
      "2026-01-05",
    ]);
    expect(semanas[0].porCombustible.get("D")).toMatchObject({
      importe: 0.3,
      galones: 0.3,
      vales: [usado, domingo],
    });
    expect(semanas[0].porCombustible.get("G")?.vales).toEqual([gasolina]);
    expect(agruparGastos(vales, "mes").map((mes) => mes.inicio)).toEqual([
      "2025-12-01",
      "2026-01-01",
    ]);
    expect(agruparGastos(vales, "anio").map((anio) => anio.inicio)).toEqual([
      "2025-01-01",
      "2026-01-01",
    ]);
  });

  it("suma en centavos y exporta exactamente los vales del resultado", () => {
    const sc = {
      ...usado,
      id_vale: "2",
      codigo_vale: "2025120002",
      nrocontrato: null,
      importe: 0.2,
      grifo: '="Proveedor";Centro',
    };
    expect(resumirGastos([usado, sc])).toEqual({
      importe: 0.3,
      conContrato: 0.1,
      sinContrato: 0.2,
      galones: 0.2,
    });
    const csv = csvGastos([sc]);
    expect(csv.split("\r\n")).toHaveLength(2);
    expect(csv).toContain(sc.codigo_vale);
    expect(csv).toContain(sc.factura_numero);
    expect(csv).toContain("'=" + '""Proveedor"";Centro');
    expect(csv).not.toContain(usado.codigo_vale);
  });

  it("resuelve meses calendarios con su último día, incluido febrero bisiesto", () => {
    expect(rangoPeriodo("mes-anterior", "2024-03-15")).toEqual({
      desde: "2024-02-01",
      hasta: "2024-02-29",
    });
  });
});
