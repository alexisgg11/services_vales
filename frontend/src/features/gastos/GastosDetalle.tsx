import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Fuel,
  Ticket,
  X,
} from "lucide-react";
import { Empty } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { money, qty } from "@/lib/api";
import { csvGastos, descargarArchivo } from "./gastos-exportacion";
import type { Vale } from "@/lib/types";
import {
  type ConsumoFacturado,
  type GastoPorCombustible,
} from "./gastos-datos";

const porPagina = 5;

export function GastosDetalle({
  vales,
  seleccion,
  desde,
  onQuitarSeleccion,
  onOpen,
}: {
  vales: ConsumoFacturado[];
  seleccion?: GastoPorCombustible;
  desde: string;
  onQuitarSeleccion: () => void;
  onOpen: (vale: Vale) => void;
}) {
  const [pagina, setPagina] = useState(0);
  const paginas = Math.max(1, Math.ceil(vales.length / porPagina));
  const actual = Math.min(pagina, paginas - 1);
  const filas = vales.slice(actual * porPagina, (actual + 1) * porPagina);

  function descargar() {
    const csv = new Blob([csvGastos(vales)], {
      type: "text/csv;charset=utf-8",
    });
    descargarArchivo(csv, "Gastos-" + desde + ".csv");
  }

  return (
    <section
      id="gastos-vales"
      className="panel gastos-detalle"
      aria-labelledby="gastos-detalle-titulo"
      tabIndex={-1}
    >
      <header className="gastos-detalle-cabecera">
        <div className="gastos-detalle-titulo">
          <h2 id="gastos-detalle-titulo">Vales facturados</h2>
          <Badge
            variant="secondary"
            className="gastos-detalle-contador"
            role="status"
            aria-label={
              vales.length === 1
                ? "1 vale facturado"
                : vales.length + " vales facturados"
            }
          >
            {vales.length}
          </Badge>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={descargar}
          disabled={!vales.length}
          aria-label="Exportar vales filtrados a CSV"
        >
          <Download aria-hidden="true" /> CSV
        </Button>
      </header>

      {seleccion && (
        <div className="gastos-detalle-filtro">
          <div>
            <strong>{seleccion.nombre}</strong>
            <small>{seleccion.periodo}</small>
          </div>
          <strong className="gastos-importe-filtro">
            {money(seleccion.importe)}
          </strong>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Quitar filtro del gráfico"
            onClick={onQuitarSeleccion}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      )}

      {filas.length === 0 ? (
        <Empty>No hay vales facturados en la consulta.</Empty>
      ) : (
        <ul className="gastos-vales-lista" aria-label="Vales de la consulta">
          {filas.map((vale) => (
            <li key={vale.id_vale}>
              <button
                type="button"
                className="gastos-vale"
                onClick={() => onOpen(vale)}
                aria-label={
                  "Ver vale " + vale.codigo_vale + " de " + vale.zonal
                }
              >
                <span className="ticket-icon">
                  <Ticket aria-hidden="true" />
                </span>
                <span className="gastos-vale-info">
                  <strong>{vale.codigo_vale}</strong>
                  <small>Factura {vale.factura_numero}</small>
                  <small className="gastos-vale-combustible">
                    <Fuel aria-hidden="true" />
                    {vale.suministro}
                  </small>
                </span>
                <span className="gastos-vale-importe">
                  <strong>{money(vale.importe)}</strong>
                  <small>{qty(vale.cantidad_consumida)} gal</small>
                </span>
                <ChevronRight
                  size={17}
                  className="gastos-vale-flecha"
                  aria-hidden="true"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {paginas > 1 && (
        <footer className="pagination">
          <small>
            Página {actual + 1} de {paginas}
          </small>
          <div className="inline">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Página anterior"
              disabled={actual === 0}
              onClick={() => setPagina(actual - 1)}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Página siguiente"
              disabled={actual + 1 === paginas}
              onClick={() => setPagina(actual + 1)}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </footer>
      )}
    </section>
  );
}
