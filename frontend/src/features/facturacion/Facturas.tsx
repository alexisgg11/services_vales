import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Receipt, CheckCircle2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InfoPopover } from "@/components/info-popover";
import { api, money, today, date } from "@/lib/api";
import type { Vale, Factura } from "@/lib/types";
import {
  Field,
  Empty,
  ErrorText,
  useData,
  useRefresh,
  useModal,
} from "@/components/common";
import { AsociarFactura } from "./AsociarFactura";
export default function Facturas({ onOpen }: { onOpen: (v: Vale) => void }) {
  const { data } = useData();
  return data!.cuenta.roles.some((r) => r.codigo_rol === "CONTABILIDAD") ? (
    <AsociarFactura onOpen={onOpen} />
  ) : (
    <EmitirFactura />
  );
}
interface Pendiente {
  id: string;
  codigo: string;
  ticket: string;
  fecha: string;
  importe: number;
  cantidad: number;
  suministro: string;
}
interface DatosGrifo {
  serie: string;
  simulada: boolean;
  pendientes: Pendiente[];
  facturas: Factura[];
}
function EmitirFactura() {
  const modal = useModal(),
    refresh = useRefresh(),
    q = useQuery({
      queryKey: ["facturas-grifo"],
      queryFn: () => api<DatosGrifo>("/api/v1/facturacion/grifo"),
    });
  const [selected, setSelected] = useState<string[]>([]),
    [fecha, setFecha] = useState(today()),
    [solicitud, setSolicitud] = useState(() => crypto.randomUUID()),
    [result, setResult] = useState<Factura>();
  const lote = q.data?.pendientes.filter((t) => selected.includes(t.id)) || [],
    total =
      lote.reduce((s, t) => s + Math.round(Number(t.importe) * 100), 0) / 100;
  return (
    <div className="stack">
      {result && (
        <div className="success-line">
          <CheckCircle2 />
          Factura {result.numero_completo} emitida por{" "}
          {money(Number(result.total))}
        </div>
      )}
      <ErrorText error={q.error} />
      <section className="panel stack">
        <div className="row spaced">
          <h2>Tickets pendientes de facturar</h2>
          <InfoPopover title="Cómo se emite la factura">
            <p>
              El número se asigna automáticamente por grifo y serie. La factura
              conserva los tickets seleccionados para su asociación desde
              Contabilidad.
            </p>
            <p>
              Las facturas del entorno de prueba son simuladas y no son
              comprobantes electrónicos tributarios.
            </p>
          </InfoPopover>
        </div>
        <Field label="Fecha de emisión">
          <Input
            aria-label="Fecha de emisión de factura"
            type="date"
            max={today()}
            value={fecha}
            onChange={(e) => {
              setFecha(e.target.value);
              setSolicitud(crypto.randomUUID());
            }}
          />
        </Field>
        {q.data?.pendientes.length === 0 && (
          <Empty>No hay atenciones pendientes de incluir en una factura.</Empty>
        )}
        <div className="invoice-tickets">
          {q.data?.pendientes.map((t) => (
            <label className="select-ticket" key={t.id}>
              <input
                type="checkbox"
                checked={selected.includes(t.id)}
                onChange={() => {
                  setSelected((s) =>
                    s.includes(t.id)
                      ? s.filter((id) => id !== t.id)
                      : [...s, t.id],
                  );
                  setSolicitud(crypto.randomUUID());
                }}
              />
              <span className="grow">
                <strong>{t.ticket}</strong>
                <small>Vale {t.codigo}</small>
                <small>
                  {t.suministro} {date(t.fecha)}
                </small>
              </span>
              <strong>{money(Number(t.importe))}</strong>
            </label>
          ))}
        </div>
        <div className="total-line">
          <span>{lote.length} tickets seleccionados</span>
          <strong>{money(total)}</strong>
        </div>
        <div className="actions">
          <Button
            disabled={!lote.length}
            onClick={() =>
              modal({
                title: "Emitir factura",
                body: (
                  <div className="stack">
                    <p>
                      El sistema asignará el siguiente número disponible de la
                      serie {q.data?.serie}.
                    </p>
                    {lote.map((t) => (
                      <p key={t.id}>
                        {t.ticket} <strong>{money(Number(t.importe))}</strong>
                      </p>
                    ))}
                    <p>Total {money(total)}</p>
                  </div>
                ),
                label: "Emitir factura",
                action: async () => {
                  const f = await api<Factura>("/api/v1/facturacion/grifo", {
                    vales: lote.map((t) => t.id),
                    fecha,
                    solicitud,
                  });
                  setResult(f);
                  setSelected([]);
                  setSolicitud(crypto.randomUUID());
                  await refresh(["contexto"], ["facturas-grifo"]);
                },
              })
            }
          >
            <Receipt />
            Emitir factura
          </Button>
        </div>
      </section>
      <section className="panel stack">
        <h2>Facturas del grifo</h2>
        {q.data?.facturas.map((f) => (
          <div className="invoice-row" key={f.codigo_factura}>
            <div className="grow">
              <strong>
                {f.serie}-{f.numero}
              </strong>
              <small>{date(f.fecha_emision)}</small>
              <small>
                {f.asociado_por
                  ? "Asociada por Contabilidad"
                  : "Pendiente de asociación"}
              </small>
            </div>
            <span>{money(Number(f.total))}</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={"Ver tickets de factura " + f.serie + "-" + f.numero}
              onClick={() =>
                modal({
                  title: "Factura " + f.serie + "-" + f.numero,
                  body: (
                    <div className="stack">
                      <p>RUC {f.cod_proveedor}</p>
                      <p>{money(Number(f.total))}</p>
                      <ul className="ticket-list">
                        {(f.tickets || []).map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  ),
                })
              }
            >
              <Eye />
            </Button>
          </div>
        ))}
      </section>
    </div>
  );
}
