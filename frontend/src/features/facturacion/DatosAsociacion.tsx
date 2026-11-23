import { BadgeCheck, CalendarDays, Fuel, X } from "lucide-react";
import { ValeCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { date, money, qty } from "@/lib/api";
import type { Factura, Vale } from "@/lib/types";

export function DatosFactura({
  factura,
  grifo,
}: {
  factura: Factura;
  grifo: string;
}) {
  return (
    <dl className="factura-datos">
      <div>
        <Fuel aria-hidden="true" />
        <dt>Grifo</dt>
        <dd>{grifo}</dd>
      </div>
      <div>
        <BadgeCheck aria-hidden="true" />
        <dt>RUC</dt>
        <dd>{factura.cod_proveedor}</dd>
      </div>
      <div>
        <CalendarDays aria-hidden="true" />
        <dt>Fecha de emisión</dt>
        <dd>{date(factura.fecha_emision)}</dd>
      </div>
    </dl>
  );
}

export function TotalAsociacion({
  titulo,
  importe,
}: {
  titulo: string;
  importe?: number;
}) {
  return (
    <div className="factura-total">
      <span>{titulo}</span>
      <strong>{importe === undefined ? "—" : money(importe)}</strong>
    </div>
  );
}

export function ValesPorAsociar({
  vales,
  onOpen,
  onQuitar,
}: {
  vales: readonly Vale[];
  onOpen: (vale: Vale) => void;
  onQuitar?: (vale: Vale) => void;
}) {
  return (
    <ul className="factura-lote">
      {vales.map((vale) => (
        <li key={vale.id_vale}>
          <ValeCard
            vale={vale}
            expand
            onOpen={onOpen}
            datos={[
              ["Trabajador", vale.trabajador],
              ["Importe real", money(vale.importe)],
              ["Ticket", vale.ticket],
              [
                "Consumido",
                <>
                  <span className="factura-consumo-cantidad">
                    {qty(vale.cantidad_consumida)} gal
                  </span>
                  {vale.suministro && (
                    <>
                      {" "}
                      <span className="factura-consumo-suministro">
                        ({vale.suministro})
                      </span>
                    </>
                  )}
                </>,
              ],
            ]}
            accionCabecera={
              onQuitar && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  title="Quitar vale"
                  aria-label={
                    "Quitar vale " + vale.codigo_vale + " de la selección"
                  }
                  onClick={() => onQuitar(vale)}
                >
                  <X aria-hidden="true" />
                </Button>
              )
            }
          />
        </li>
      ))}
    </ul>
  );
}
