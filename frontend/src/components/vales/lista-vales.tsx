import { useState, type ReactNode } from "react";
import { Eye, ChevronLeft, ChevronRight, Fuel, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/feedback";
import { State } from "@/components/vales/estado";
import { ValeCard } from "@/components/vales/TarjetaVale";
import { money, date, qty } from "@/lib/api";
import type { Vale } from "@/lib/types";
export function ValesList({
  vales,
  onOpen,
  selected,
  onSelect,
  seleccionMovil,
  primaryAction,
  action,
  vista = "general",
  emptyMessage = "No hay vales para esta consulta.",
}: {
  vales: Vale[];
  onOpen: (v: Vale) => void;
  selected?: string[];
  onSelect?: (v: Vale) => void;
  seleccionMovil?: { activa: boolean; mantener: (vale: Vale) => void };
  primaryAction?: {
    title: string;
    icon: ReactNode;
    label: (v: Vale) => string;
    onClick: (v: Vale) => void;
    disabled?: boolean;
    mobileCard?: {
      label: (v: Vale) => string;
      onClick: (v: Vale) => void;
    };
  };
  action?: (v: Vale) => ReactNode;
  vista?: "general" | "solicitudes" | "facturacion";
  emptyMessage?: string;
}) {
  const [page, setPage] = useState(0);
  const solicitudes = vista === "solicitudes";
  const facturacion = vista === "facturacion";
  const mobileAction = primaryAction?.mobileCard ?? primaryAction;
  const seleccionarEnTarjeta = seleccionMovil?.activa ? onSelect : undefined;
  const pages = Math.max(1, Math.ceil(vales.length / 10)),
    current = Math.min(page, pages - 1),
    rows = vales.slice(current * 10, current * 10 + 10);
  if (!vales.length) return <Empty>{emptyMessage}</Empty>;
  return (
    <div className={"list-surface" + (solicitudes ? " solicitudes-lista" : "")}>
      <div className="mobile-cards">
        {rows.map((v) => (
          <div
            className="select-card"
            key={v.id_vale}
            data-seleccionado={selected?.includes(v.id_vale) || undefined}
          >
            {onSelect && !seleccionMovil && (
              <label className="vale-select-control">
                <input
                  type="checkbox"
                  aria-label={
                    "Seleccionar vale " + v.codigo_vale + " " + v.zonal
                  }
                  checked={selected?.includes(v.id_vale) || false}
                  onChange={() => onSelect(v)}
                />
              </label>
            )}
            <div className="mobile-vale-content">
              <ValeCard
                vale={v}
                onOpen={seleccionarEnTarjeta ?? mobileAction?.onClick ?? onOpen}
                openLabel={
                  seleccionarEnTarjeta
                    ? "Seleccionar vale " + v.codigo_vale + " de " + v.zonal
                    : mobileAction?.label(v)
                }
                openDisabled={primaryAction?.disabled}
                seleccionTactil={
                  seleccionMovil && onSelect
                    ? {
                        marcada: seleccionMovil.activa
                          ? (selected?.includes(v.id_vale) ?? false)
                          : undefined,
                        mantener: () => seleccionMovil.mantener(v),
                      }
                    : undefined
                }
                datos={
                  solicitudes
                    ? [
                        ["Trabajador", v.trabajador],
                        ["Grifo", v.grifo],
                        [
                          "Combustible",
                          <>
                            {v.suministro}
                            <small>{qty(v.cantidad_emitida)} gal</small>
                          </>,
                        ],
                        [
                          "Importe estimado",
                          <strong>{money(v.importe_estimado)}</strong>,
                        ],
                      ]
                    : undefined
                }
              />
              {!primaryAction && action && (
                <div className="mobile-vale-actions">{action(v)}</div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div
        className="table-scroll desktop-table"
        role="region"
        aria-label="Lista de vales"
        tabIndex={0}
      >
        <table>
          {facturacion && (
            <colgroup>
              {onSelect && <col className="factura-col-seleccion" />}
              <col />
              <col className="factura-col-ticket" />
              <col className="factura-col-consumo" />
              <col className="factura-col-importe" />
            </colgroup>
          )}
          <thead>
            <tr>
              {onSelect && (
                <th className="check-col">
                  <span className="sr-only">Seleccionar</span>
                </th>
              )}
              <th className="sticky-code">
                {vista === "general" ? "Código" : "Vale"}
              </th>
              {!facturacion && <th>Trabajador</th>}
              {solicitudes && <th>Centro de costo</th>}
              {!facturacion && <th>Grifo</th>}
              {solicitudes ? (
                <>
                  <th>Combustible</th>
                  <th className="numeric">Importe estimado</th>
                </>
              ) : (
                <>
                  {!facturacion && <th>Estado</th>}
                  <th>Ticket</th>
                  <th className={facturacion ? "numeric" : undefined}>
                    {facturacion ? "Consumido (gal)" : "Consumo"}
                  </th>
                  <th className={facturacion ? "numeric" : undefined}>
                    Importe
                  </th>
                </>
              )}
              {!facturacion && (
                <th>
                  <span className="sr-only">Acciones</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr
                key={v.id_vale}
                data-seleccionado={selected?.includes(v.id_vale) || undefined}
              >
                {onSelect && (
                  <td className="check-col">
                    <input
                      type="checkbox"
                      aria-label={
                        "Seleccionar vale " + v.codigo_vale + " " + v.zonal
                      }
                      checked={selected?.includes(v.id_vale) || false}
                      onChange={() => onSelect(v)}
                    />
                  </td>
                )}
                <td className="sticky-code">
                  <button className="code-link" onClick={() => onOpen(v)}>
                    {v.codigo_vale}
                    <small>
                      {facturacion && <MapPin aria-hidden="true" />}
                      {v.zonal}
                    </small>
                    {facturacion && (
                      <small>
                        <Fuel aria-hidden="true" />
                        {v.grifo}
                      </small>
                    )}
                    {solicitudes && <small>{date(v.fecha_emision)}</small>}
                  </button>
                </td>
                {!facturacion && (
                  <td>
                    {v.trabajador}
                    <small>
                      {v.placa || (solicitudes ? "Sin unidad móvil" : null)}
                    </small>
                  </td>
                )}
                {solicitudes && (
                  <td>{v.centro_costo || "Sin centro de costo"}</td>
                )}
                {!facturacion && <td>{v.grifo}</td>}
                {solicitudes ? (
                  <>
                    <td>
                      {v.suministro}
                      <small>{qty(v.cantidad_emitida)} gal</small>
                    </td>
                    <td className="numeric">{money(v.importe_estimado)}</td>
                  </>
                ) : (
                  <>
                    {!facturacion && (
                      <td>
                        <State vale={v} />
                      </td>
                    )}
                    <td className={facturacion ? "factura-ticket" : undefined}>
                      {v.ticket || "Sin atención"}
                    </td>
                    <td className={facturacion ? "numeric" : undefined}>
                      {facturacion ? (
                        qty(v.cantidad_consumida)
                      ) : (
                        <>
                          {v.fecha_consumo
                            ? date(v.fecha_consumo)
                            : date(v.fecha_emision)}
                          <small>
                            {qty(v.cantidad_consumida ?? v.cantidad_emitida)}{" "}
                            gal
                          </small>
                        </>
                      )}
                    </td>
                    <td className="numeric">
                      {money(v.importe ?? v.importe_estimado)}
                    </td>
                  </>
                )}
                {!facturacion && (
                  <td>
                    <div className="inline">
                      {primaryAction && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title={primaryAction.title}
                          disabled={primaryAction.disabled}
                          aria-label={primaryAction.label(v)}
                          onClick={() => primaryAction.onClick(v)}
                        >
                          {primaryAction.icon}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={"Ver detalle de " + v.codigo_vale}
                        onClick={() => onOpen(v)}
                      >
                        <Eye />
                      </Button>
                      {action?.(v)}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(!solicitudes || pages > 1) && (
        <div className="pagination">
          <small>{vales.length} vales</small>
          <div className="inline">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Página anterior"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft />
            </Button>
            <small>
              {current + 1} de {pages}
            </small>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Página siguiente"
              disabled={current + 1 >= pages}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
