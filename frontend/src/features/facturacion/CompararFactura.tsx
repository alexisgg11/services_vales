import { useId } from "react";
import {
  ArrowLeftRight,
  CircleAlert,
  CircleCheck,
  FileCheck2,
  Tickets,
  WandSparkles,
} from "lucide-react";
import { InfoPopover } from "@/components/info-popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/common";
import { money } from "@/lib/api";
import type { Factura, Vale } from "@/lib/types";
import {
  DatosFactura,
  TotalAsociacion,
  ValesPorAsociar,
} from "./DatosAsociacion";
import type { cambiosDeSeleccion, conciliar } from "./conciliar";

type Resultado = ReturnType<typeof conciliar>;
type Cambios = ReturnType<typeof cambiosDeSeleccion>;

const numero = (factura: Factura) => factura.serie + "-" + factura.numero;

function GrupoTickets({
  titulo,
  tickets,
  tono,
}: {
  titulo: string;
  tickets: string[];
  tono?: "conforme" | "pendiente";
}) {
  if (!tickets.length) return null;
  return (
    <div className="factura-grupo-tickets" data-tono={tono}>
      <h4>{titulo}</h4>
      <ul>
        {tickets.map((ticket, i) => (
          <li key={ticket + "-" + i}>{ticket}</li>
        ))}
      </ul>
    </div>
  );
}

export function DiagnosticoFactura({
  factura,
  resultado,
  cambios,
}: {
  factura: Factura;
  resultado: Resultado;
  cambios: Cambios;
}) {
  const Icono = resultado.listo ? CircleCheck : CircleAlert;
  const mensaje = resultado.listo
    ? "Los tickets y el importe coinciden."
    : !factura.tickets?.length
      ? "Factura sin tickets registrados."
      : !resultado.tickets
        ? "Revisa los tickets de la selección."
        : resultado.importes
          ? "Revisa la disponibilidad de los vales."
          : "Revisa la diferencia de importe.";
  return (
    <div className="factura-estado" data-listo={resultado.listo}>
      <Icono aria-hidden="true" />
      <div className="factura-estado-texto" role="status">
        <strong>{mensaje}</strong>
        {resultado.diferencia !== 0 && (
          <p>
            {resultado.diferencia < 0
              ? "La factura supera el total de los vales en "
              : "El total de los vales supera la factura en "}
            {money(Math.abs(resultado.diferencia))}.
          </p>
        )}
      </div>
      {!!factura.tickets?.length && (
        <InfoPopover title="Comparación de tickets">
          <div className="factura-grupos-tickets">
            <GrupoTickets
              titulo="Coinciden"
              tickets={resultado.coincidentes}
              tono="conforme"
            />
            <GrupoTickets
              titulo="Faltan en la selección"
              tickets={cambios.agregar.map((vale) => vale.ticket)}
              tono="pendiente"
            />
            <GrupoTickets
              titulo="Sobran en la selección"
              tickets={cambios.quitar.map(
                (vale) => vale.ticket ?? "Vale " + vale.codigo_vale,
              )}
              tono="pendiente"
            />
            <GrupoTickets
              titulo="Sin vale disponible"
              tickets={cambios.sinVale}
              tono="pendiente"
            />
          </div>
        </InfoPopover>
      )}
    </div>
  );
}

export function CompararFactura({
  vales,
  grifo,
  factura,
  facturas,
  resultado,
  avisoOptimizacion,
  onElegir,
  onOptimizar,
  onOpen,
  onQuitar,
}: {
  vales: readonly Vale[];
  grifo: string;
  factura?: Factura;
  facturas: readonly Factura[];
  resultado: Resultado;
  avisoOptimizacion: string;
  onElegir: (id: string) => void;
  onOptimizar: () => void;
  onOpen: (vale: Vale) => void;
  onQuitar: (vale: Vale) => void;
}) {
  const tituloFactura = useId();
  const tituloVales = useId();

  return (
    <div className="factura-comparacion" data-listo={resultado.listo}>
      <section aria-labelledby={tituloVales} className="factura-tarjeta">
        <div className="factura-tarjeta-titulo">
          <Tickets aria-hidden="true" />
          <h3 id={tituloVales}>Vales seleccionados</h3>
          <Badge variant="secondary" className="factura-recuento">
            {vales.length}
          </Badge>
        </div>
        {vales.length ? (
          <div
            className="factura-lote-scroll"
            role="region"
            aria-labelledby={tituloVales}
            tabIndex={0}
          >
            <ValesPorAsociar
              vales={vales}
              onOpen={onOpen}
              onQuitar={onQuitar}
            />
          </div>
        ) : (
          <p className="muted">Selecciona los vales de la lista.</p>
        )}
        <TotalAsociacion
          titulo="Total de vales"
          importe={vales.length ? resultado.suma : undefined}
        />
      </section>
      <ArrowLeftRight
        className="factura-comparacion-flecha"
        aria-hidden="true"
      />
      <section aria-labelledby={tituloFactura} className="factura-tarjeta">
        <div className="factura-tarjeta-titulo">
          <FileCheck2 aria-hidden="true" />
          <h3 id={tituloFactura}>Factura</h3>
        </div>
        <Field label="Número de factura">
          <div className="factura-selector">
            <select
              value={factura?.codigo_factura ?? ""}
              disabled={!vales.length || !facturas.length}
              onChange={(evento) => onElegir(evento.target.value)}
            >
              <option value="">
                {!vales.length
                  ? "Primero selecciona los vales"
                  : !facturas.length
                    ? "Sin facturas pendientes"
                    : "Seleccionar factura"}
              </option>
              {facturas.map((opcion) => (
                <option
                  key={opcion.codigo_factura}
                  value={opcion.codigo_factura}
                >
                  {numero(opcion)}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="factura-optimizar"
              disabled={!vales.length || !facturas.length}
              title="Optimizar asociación"
              aria-label="Optimizar asociación"
              onClick={onOptimizar}
            >
              <WandSparkles aria-hidden="true" />
            </Button>
          </div>
        </Field>
        {avisoOptimizacion && (
          <p className="factura-aviso-optimizacion" role="status">
            {avisoOptimizacion}
          </p>
        )}
        {factura && <DatosFactura factura={factura} grifo={grifo} />}
        <TotalAsociacion titulo="Importe de factura" importe={factura?.total} />
      </section>
    </div>
  );
}
