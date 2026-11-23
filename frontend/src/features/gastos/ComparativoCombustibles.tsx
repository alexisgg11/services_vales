import { useMemo, type MouseEvent, type ReactNode, type Ref } from "react";
import { ArrowDownRight, ArrowRight } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Empty } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { money, qty } from "@/lib/api";
import {
  agrupacionesGastos,
  type Agrupacion,
  type GastoPorCombustible,
  type GrupoGasto,
  type Metrica,
  type SerieGasto,
} from "./gastos-datos";

const eje = new Intl.NumberFormat("es-PE", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function valor(cantidad: number, metrica: Metrica) {
  return metrica === "importe" ? money(cantidad) : qty(cantidad) + " gal";
}

function AyudaComparativo({
  grupo,
  series,
  metrica,
}: {
  grupo: GrupoGasto;
  series: SerieGasto[];
  metrica: Metrica;
}) {
  return (
    <div className="gastos-tooltip">
      <strong>
        {grupo.porCombustible.values().next().value?.periodo ?? grupo.etiqueta}
      </strong>
      <ul>
        {series.map((serie) => {
          const gasto = grupo.porCombustible.get(serie.id);
          const vales = gasto?.vales.length ?? 0;
          return (
            <li key={serie.id}>
              <span
                className="gastos-punto"
                style={{ background: serie.color }}
              />
              <span className="gastos-tooltip-combustible">
                {serie.nombre}
                <small>
                  {vales} {vales === 1 ? "vale" : "vales"}
                </small>
              </span>
              <b>{valor(gasto?.[metrica] ?? 0, metrica)}</b>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PuntoInteractivo({
  gasto,
  metrica,
  seleccion,
  onSeleccionar,
  onPulsar,
  children,
}: {
  gasto: GastoPorCombustible;
  metrica: Metrica;
  seleccion?: GastoPorCombustible;
  onSeleccionar: (gasto: GastoPorCombustible) => void;
  onPulsar: (event: MouseEvent<SVGGElement>) => void;
  children: (activa: boolean, atenuada: boolean) => ReactNode;
}) {
  const activa =
    seleccion?.inicio === gasto.inicio &&
    seleccion.suministro === gasto.suministro;
  return (
    <g
      className="gastos-marca gastos-punto-linea"
      role="button"
      tabIndex={0}
      data-periodo={gasto.inicio}
      data-combustible={gasto.suministro}
      aria-pressed={activa}
      aria-label={`Filtrar ${gasto.nombre}, ${gasto.periodo}, ${valor(gasto[metrica], metrica)}`}
      onClick={onPulsar}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) onSeleccionar(gasto);
      }}
    >
      {children(activa, !!seleccion && !activa)}
    </g>
  );
}

export function ComparativoCombustibles({
  ref,
  grupos,
  series,
  metrica,
  onCambiarMetrica,
  agrupacion,
  onAgrupar,
  seleccion,
  onSeleccionar,
}: {
  ref?: Ref<HTMLElement>;
  grupos: GrupoGasto[];
  series: SerieGasto[];
  metrica: Metrica;
  onCambiarMetrica: (metrica: Metrica) => void;
  agrupacion: Agrupacion;
  onAgrupar: (agrupacion: Agrupacion) => void;
  seleccion: GastoPorCombustible | undefined;
  onSeleccionar: (gasto: GastoPorCombustible) => void;
}) {
  const porPeriodo = useMemo(
    () => new Map(grupos.map((grupo) => [grupo.inicio, grupo])),
    [grupos],
  );
  const seriesConVales = series.filter((serie) => serie.conVales);
  const datos = useMemo(
    () =>
      grupos.map(({ inicio, porCombustible }) => ({
        inicio,
        valores: Object.fromEntries(
          [...porCombustible].map(([id, gasto]) => [id, gasto[metrica]]),
        ),
      })),
    [grupos, metrica],
  );

  const ejes = (
    <>
      <CartesianGrid vertical={false} stroke="#e0e9ed" strokeDasharray="4 5" />
      <XAxis
        dataKey="inicio"
        axisLine={false}
        tickLine={false}
        tickMargin={9}
        minTickGap={5}
        padding={{ left: 19, right: 19 }}
        tickFormatter={(inicio: string) =>
          porPeriodo.get(inicio)?.etiqueta ?? inicio
        }
      />
      <YAxis
        axisLine={false}
        tickLine={false}
        width={42}
        tickMargin={4}
        tickCount={5}
        tickFormatter={(n: number) => eje.format(n)}
      />
      <Tooltip
        cursor={{ stroke: "#b3cbd4", strokeDasharray: "4 4" }}
        content={({ active, label }) => {
          const grupo = porPeriodo.get(String(label));
          return active && grupo ? (
            <AyudaComparativo
              grupo={grupo}
              series={seriesConVales}
              metrica={metrica}
            />
          ) : null;
        }}
      />
    </>
  );
  const margen = { top: 12, left: 0, right: 8, bottom: 0 };
  const interaccion = { metrica, seleccion, onSeleccionar };

  function seleccionarPunto(
    event: MouseEvent<SVGGElement>,
    gasto: GastoPorCombustible,
  ) {
    const puntos =
      event.currentTarget.ownerSVGElement?.querySelectorAll<SVGGElement>(
        ".gastos-punto-linea",
      );
    const grupo = porPeriodo.get(gasto.inicio);
    let masCercano = gasto;
    let distanciaMinima = Infinity;
    // Dos áreas de toque pueden cruzarse. Compara la distancia a los puntos visibles.
    for (const punto of puntos ?? []) {
      if (punto.dataset.periodo !== gasto.inicio) continue;
      const alternativa = grupo?.porCombustible.get(
        punto.dataset.combustible ?? "",
      );
      const marca = punto
        .querySelector(".gastos-grafico-marca")
        ?.getBoundingClientRect();
      if (!alternativa || !marca) continue;
      const distancia = Math.hypot(
        event.clientX - marca.left - marca.width / 2,
        event.clientY - marca.top - marca.height / 2,
      );
      if (
        distancia < distanciaMinima ||
        (distancia === distanciaMinima && alternativa === gasto)
      ) {
        distanciaMinima = distancia;
        masCercano = alternativa;
      }
    }
    onSeleccionar(masCercano);
  }

  return (
    <section
      ref={ref}
      className="panel gastos-comparativo"
      aria-labelledby="gastos-comparativo-titulo"
    >
      <header className="gastos-comparativo-cabecera">
        <h2 id="gastos-comparativo-titulo">Comparativo de combustibles</h2>
        <select
          className="gastos-agrupacion"
          aria-label="Agrupar por"
          value={agrupacion}
          onChange={(event) =>
            onAgrupar(event.currentTarget.value as Agrupacion)
          }
        >
          {agrupacionesGastos.map(({ id, etiqueta }) => (
            <option key={id} value={id}>
              {etiqueta}
            </option>
          ))}
        </select>
        <div
          className="gastos-segmentado gastos-segmentado-unidad"
          role="group"
          aria-label="Unidad del comparativo"
        >
          <button
            type="button"
            aria-pressed={metrica === "importe"}
            onClick={() => onCambiarMetrica("importe")}
          >
            Importe
          </button>
          <button
            type="button"
            aria-pressed={metrica === "galones"}
            onClick={() => onCambiarMetrica("galones")}
          >
            Galones
          </button>
        </div>
      </header>
      {grupos.length > 0 ? (
        <>
          <div className="gastos-grafico-unidad" aria-hidden="true">
            {metrica === "importe" ? "S/" : "gal"}
          </div>
          <div
            className="gastos-grafico-scroll"
            role="region"
            aria-label="Comparativo de líneas"
            tabIndex={0}
          >
            <div
              className="gastos-grafico"
              style={{ minWidth: 42 + grupos.length * 70 }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart accessibilityLayer data={datos} margin={margen}>
                  {ejes}
                  {seriesConVales.map((serie) => (
                    <Line
                      key={serie.id}
                      dataKey={(dato: (typeof datos)[number]) =>
                        dato.valores[serie.id] ?? 0
                      }
                      name={serie.nombre}
                      type="linear"
                      stroke={serie.color}
                      strokeWidth={2.5}
                      strokeDasharray={serie.trazo}
                      strokeOpacity={
                        seleccion && seleccion.suministro !== serie.id
                          ? 0.58
                          : 1
                      }
                      activeDot={false}
                      animationDuration={360}
                      dot={({ cx, cy, payload }) => {
                        const gasto = porPeriodo
                          .get(String(payload?.inicio))
                          ?.porCombustible.get(serie.id);
                        if (cx == null || cy == null) return null;
                        if (!gasto)
                          return (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={3}
                              fill="white"
                              stroke={serie.color}
                              data-periodo-pdf={payload?.inicio}
                              aria-hidden="true"
                            />
                          );
                        return (
                          <PuntoInteractivo
                            gasto={gasto}
                            {...interaccion}
                            onPulsar={(evento) =>
                              seleccionarPunto(evento, gasto)
                            }
                          >
                            {(activa, atenuada) => (
                              <>
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={22}
                                  fill="transparent"
                                />
                                {activa && (
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={12}
                                    fill={serie.color}
                                    opacity={0.16}
                                    pointerEvents="none"
                                  />
                                )}
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={activa ? 7 : 5}
                                  fill={serie.color}
                                  stroke="white"
                                  strokeWidth={2}
                                  className="gastos-grafico-marca"
                                  data-periodo-pdf={gasto.inicio}
                                  data-atenuada={atenuada}
                                  aria-hidden="true"
                                />
                              </>
                            )}
                          </PuntoInteractivo>
                        );
                      }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          {series.length > 0 && (
            <footer className="gastos-comparativo-pie">
              <ul className="gastos-leyenda" aria-label="Combustibles">
                {series.map((serie) => (
                  <li key={serie.id} data-sin-vales={!serie.conVales}>
                    <span
                      className="gastos-punto"
                      aria-hidden="true"
                      style={{ background: serie.color }}
                    />
                    {serie.nombre}
                  </li>
                ))}
              </ul>
              {seleccion && (
                <>
                  <div className="gastos-marca-activa">
                    <span
                      className="gastos-punto"
                      style={{
                        background: series.find(
                          (serie) => serie.id === seleccion.suministro,
                        )?.color,
                      }}
                    />
                    <div>
                      <strong>{seleccion.nombre}</strong>
                      <small>{seleccion.periodo}</small>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="gastos-ver-vales"
                    onClick={() =>
                      document.getElementById("gastos-vales")?.focus()
                    }
                  >
                    {seleccion.vales.length === 1
                      ? "Ver vale"
                      : "Ver " + seleccion.vales.length + " vales"}
                    <span className="gastos-flecha-lateral">
                      <ArrowRight aria-hidden="true" />
                    </span>
                    <span className="gastos-flecha-abajo">
                      <ArrowDownRight aria-hidden="true" />
                    </span>
                  </Button>
                </>
              )}
            </footer>
          )}
        </>
      ) : (
        <Empty>No hay consumos facturados para comparar.</Empty>
      )}
    </section>
  );
}
