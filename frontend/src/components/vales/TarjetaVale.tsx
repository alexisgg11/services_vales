import { useState, type ReactNode } from "react";
import { Eye, MapPin, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/api";
import type { Vale } from "@/lib/types";
import { ValeCardLink, type SeleccionTactil } from "./card-link";
import { State } from "./estado";

export function ValeCard({
  vale: v,
  onOpen,
  openLabel,
  openDisabled,
  seleccionTactil,
  expand = false,
  children,
  identityOnly = false,
  datos,
  accionCabecera,
}: {
  vale: Vale;
  onOpen?: (v: Vale) => void;
  openLabel?: string;
  openDisabled?: boolean;
  seleccionTactil?: SeleccionTactil;
  expand?: boolean;
  children?: ReactNode;
  identityOnly?: boolean;
  datos?: readonly (readonly [string, ReactNode])[];
  accionCabecera?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const Header = expand ? "button" : "div";
  const campos = datos ?? [
    ["Trabajador", v.trabajador],
    ["Grifo", v.grifo],
    [v.ticket ? "Ticket" : "Suministro", v.ticket || v.suministro],
    [
      v.importe != null ? "Importe real" : "Importe estimado",
      money(v.importe ?? v.importe_estimado),
    ],
  ];
  return (
    <article
      className={"vale-card" + (identityOnly ? " vale-card-identity-only" : "")}
    >
      <Header
        type={expand ? "button" : undefined}
        className="vale-card-head"
        data-accion-cabecera={accionCabecera ? "" : undefined}
        onClick={expand ? () => setOpen(!open) : undefined}
        aria-label={
          expand ? "Ver vale " + v.codigo_vale + " de " + v.zonal : undefined
        }
        aria-expanded={expand ? open : undefined}
      >
        <span className="ticket-icon">
          <Ticket />
        </span>
        <span className="grow">
          {identityOnly && (
            <span className="vale-identity-label">Vale de combustible</span>
          )}
          <strong>{v.codigo_vale}</strong>
          <span className="meta">
            {!identityOnly && <MapPin size={13} />}
            {v.zonal}
          </span>
        </span>
        <State vale={v} />
      </Header>
      {!identityOnly && (!expand || open) && (
        <div className="vale-card-body">
          <dl className="facts">
            {campos.map(([etiqueta, valor]) => (
              <div key={etiqueta}>
                <dt>{etiqueta}</dt>
                <dd>{valor}</dd>
              </div>
            ))}
          </dl>
          {expand && onOpen && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="vale-card-ver-detalle"
              aria-label={"Detalle completo de " + v.codigo_vale}
              onClick={() => onOpen(v)}
            >
              <Eye aria-hidden="true" /> Ver detalle
            </Button>
          )}
          {children}
        </div>
      )}
      {!identityOnly && !expand && onOpen && (
        <ValeCardLink
          etiqueta={openLabel ?? "Ver vale " + v.codigo_vale + " de " + v.zonal}
          disabled={openDisabled}
          abrir={() => onOpen(v)}
          seleccion={seleccionTactil}
        />
      )}
      {accionCabecera && (
        <div className="vale-card-accion-cabecera">{accionCabecera}</div>
      )}
    </article>
  );
}
