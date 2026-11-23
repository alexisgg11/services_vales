import { useMemo, useRef, useState } from "react";
import { ReceiptText } from "lucide-react";
import { Busy, ErrorText, useData } from "@/components/common";
import { money, today } from "@/lib/api";
import { guardarValor, leerPreferencia } from "@/lib/almacenamiento";
import type { Vale } from "@/lib/types";
import { ComparativoCombustibles } from "./ComparativoCombustibles";
import { GastosDetalle } from "./GastosDetalle";
import { GastosFiltros } from "./GastosFiltros";
import { GastosReportes } from "./GastosReportes";
import {
  agruparGastos,
  camposFiltrosGastos,
  esConsumoFacturado,
  filtrarGastos,
  rangoPeriodo,
  resumirGastos,
  seriesDeGastos,
  type Agrupacion,
  type FiltrosGastos,
  type GastoPorCombustible,
  type Metrica,
} from "./gastos-datos";
import "./gastos.css";

const importeKpi = (importe: number) => money(importe).replace("\u00a0", " ");

export default function Gastos({ onOpen }: { onOpen: (v: Vale) => void }) {
  const consulta = useData();
  const indicadores = useRef<HTMLDListElement>(null);
  const comparativo = useRef<HTMLElement>(null);
  const [filtros, setFiltros] = useState<FiltrosGastos>(() => ({
    periodo: "meses-3",
    ...rangoPeriodo("meses-3", today()),
    zonal: "",
    suministro: "",
    modalidad: "",
    grifo: "",
    centro: "",
  }));
  const [agrupacion, setAgrupacion] = useState<Agrupacion>(() =>
    leerPreferencia(
      "vales-gastos-agrupacion",
      ["semana", "mes", "anio"],
      "mes",
    ),
  );
  const [metrica, setMetrica] = useState<Metrica>(() =>
    leerPreferencia("vales-gastos-unidad", ["importe", "galones"], "importe"),
  );
  const [seleccion, setSeleccion] =
    useState<Pick<GastoPorCombustible, "inicio" | "suministro">>();

  const consumos = useMemo(
    () =>
      (consulta.data?.vales ?? [])
        .filter(esConsumoFacturado)
        .sort((a, b) => b.fecha_consumo.localeCompare(a.fecha_consumo)),
    [consulta.data?.vales],
  );
  const centros = useMemo(() => {
    const opciones = new Map<string, string>();
    for (const vale of consumos) {
      if (vale.cod_centrocosto && vale.centro_costo) {
        opciones.set(vale.cod_centrocosto, vale.centro_costo);
      }
    }
    return [...opciones].sort((a, b) => a[1].localeCompare(b[1], "es-PE"));
  }, [consumos]);
  const vales = useMemo(
    () => filtrarGastos(consumos, filtros),
    [consumos, filtros],
  );
  const resumen = useMemo(() => resumirGastos(vales), [vales]);
  const grupos = useMemo(
    () => agruparGastos(vales, agrupacion),
    [vales, agrupacion],
  );
  const gastoActivo = seleccion
    ? grupos
        .find((grupo) => grupo.inicio === seleccion.inicio)
        ?.porCombustible.get(seleccion.suministro)
    : undefined;

  if (!consulta.data) {
    return consulta.error ? <ErrorText error={consulta.error} /> : <Busy />;
  }
  const cuenta = consulta.data.cuenta;
  const campos = camposFiltrosGastos(cuenta, centros);
  const series = seriesDeGastos(grupos, cuenta.suministros, filtros.suministro);
  const valesDetalle = gastoActivo?.vales ?? vales;

  return (
    <>
      <header className="page-heading gastos-titulo">
        <div>
          <h1>Consultar gastos</h1>
          <p>Control de combustible</p>
        </div>
        <GastosReportes
          origen={consulta.data.publicBaseUrl || location.origin}
          elementos={{ indicadores, comparativo }}
          datos={{
            filtros,
            campos,
            resumen,
            grupos,
            series,
            agrupacion,
            metrica,
            vales: valesDetalle,
            seleccion: gastoActivo,
          }}
        />
      </header>
      <div className="stack gastos-consulta">
        <div className="gastos-encabezado">
          <GastosFiltros
            filtros={filtros}
            campos={campos}
            onChange={(nuevos) => {
              setFiltros(nuevos);
              setSeleccion(undefined);
            }}
          />
          <dl
            ref={indicadores}
            className="gastos-kpis"
            aria-label="Importes facturados"
          >
            <div className="panel">
              <dt>
                <ReceiptText aria-hidden="true" /> Total facturado
              </dt>
              <dd>{importeKpi(resumen.importe)}</dd>
            </div>
            <div className="panel">
              <dt>Con contrato</dt>
              <dd>{importeKpi(resumen.conContrato)}</dd>
            </div>
            <div className="panel">
              <dt aria-label="Sin contrato">S/C</dt>
              <dd>{importeKpi(resumen.sinContrato)}</dd>
            </div>
          </dl>
        </div>
        <ErrorText error={consulta.error} />

        <div className="gastos-revision">
          <ComparativoCombustibles
            ref={comparativo}
            grupos={grupos}
            series={series}
            metrica={metrica}
            onCambiarMetrica={(valor) => {
              setMetrica(valor);
              guardarValor("localStorage", "vales-gastos-unidad", valor);
            }}
            agrupacion={agrupacion}
            onAgrupar={(valor) => {
              setAgrupacion(valor);
              setSeleccion(undefined);
              guardarValor("localStorage", "vales-gastos-agrupacion", valor);
            }}
            seleccion={gastoActivo}
            onSeleccionar={(gasto) =>
              setSeleccion(
                gastoActivo === gasto
                  ? undefined
                  : {
                      inicio: gasto.inicio,
                      suministro: gasto.suministro,
                    },
              )
            }
          />

          <GastosDetalle
            key={JSON.stringify([
              filtros,
              gastoActivo?.inicio,
              gastoActivo?.suministro,
            ])}
            vales={valesDetalle}
            seleccion={gastoActivo}
            desde={filtros.desde}
            onQuitarSeleccion={() => {
              setSeleccion(undefined);
              requestAnimationFrame(() =>
                document.getElementById("gastos-vales")?.focus(),
              );
            }}
            onOpen={onOpen}
          />
        </div>
      </div>
    </>
  );
}
