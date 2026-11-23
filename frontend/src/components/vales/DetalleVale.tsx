import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  CircleSlash,
  Droplet,
  FileText,
  History,
  MessageSquare,
  Receipt,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/feedback";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { api, date, money, qty } from "@/lib/api";
import { detalleValeConsulta, useData } from "@/lib/consultas";
import { puedeAutorizarVale } from "@/lib/permisos";
import type { RutaTrabajo, Vale } from "@/lib/types";
import { useValePdf } from "./pdf-provider";
import { RutaDelVale } from "./ruta-vale";
import { ValeCard } from "./TarjetaVale";

function Qr({ url }: { url: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 4,
      width: 240,
    }).then((v) => {
      if (alive) setSrc(v);
    });
    return () => {
      alive = false;
    };
  }, [url]);
  return src ? (
    <img className="qr" src={src} alt="Código QR para consultar el vale" />
  ) : null;
}

function ValeDetailSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="vale-detail-section">
      <h3>
        <Icon aria-hidden="true" />
        {title}
      </h3>
      {children}
    </section>
  );
}
function ValeDetailFacts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="facts vale-facts">
      {items
        .filter(([, value]) => value != null && value !== "")
        .map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
    </dl>
  );
}
export function ValeDetail({
  vale: selected,
  onClose,
  onAttend,
  onAuthorize,
}: {
  vale: Vale | null;
  onClose: () => void;
  onAttend?: (v: Vale) => void;
  onAuthorize?: (v: Vale) => void;
}) {
  const latest = useQuery({
    ...detalleValeConsulta(selected?.id_qr ?? ""),
    enabled: !!selected?.id_qr,
  });
  const v = latest.data?.vale || selected;
  const ruta = useQuery({
    queryKey: ["ruta-vale", v?.id_vale],
    enabled: !!v?.id_vale,
    staleTime: Infinity,
    queryFn: ({ signal }) =>
      api<RutaTrabajo | null>(
        "/api/v1/emision/vales/" + v!.id_vale + "/ruta",
        undefined,
        signal,
      ),
  });
  const data = useData().data;
  const sheetRoot = useRef<HTMLDivElement>(null);
  const openPdf = useValePdf();
  if (!v) return null;
  const puedeAutorizar =
    onAuthorize && data && puedeAutorizarVale(data.cuenta, v);
  const url = (data?.publicBaseUrl || location.origin) + "/vales/q/" + v.id_qr;
  return (
    <Sheet
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="vale-detail-sheet"
        ref={sheetRoot}
        closeLabel="Cerrar panel"
        onOpenAutoFocus={(evento) => {
          evento.preventDefault();
          sheetRoot.current
            ?.querySelector<HTMLButtonElement>('[data-slot="sheet-close"]')
            ?.focus({ preventScroll: true });
        }}
      >
        <SheetHeader className="vale-detail-header">
          <SheetTitle>
            Vale {v.codigo_vale} ({v.zonal})
          </SheetTitle>
          <SheetDescription>Detalle del vale</SheetDescription>
        </SheetHeader>
        <div className="vale-detail-body">
          {latest.isFetching && (
            <p role="status" className="muted">
              Actualizando datos del vale
            </p>
          )}
          <ErrorText error={latest.error} />
          <ValeCard vale={v} identityOnly />
          {puedeAutorizar && (
            <section
              className="vale-solicitud"
              aria-label="Resumen de la solicitud"
            >
              <dl className="vale-solicitud-importes">
                <div>
                  <dt>Cantidad solicitada</dt>
                  <dd>{qty(v.cantidad_emitida)} gal</dd>
                  <small>{v.suministro}</small>
                </div>
                <div>
                  <dt>Importe estimado</dt>
                  <dd>{money(v.importe_estimado)}</dd>
                </div>
              </dl>
              <ValeDetailFacts
                items={[
                  ["Trabajador", v.trabajador],
                  ["Unidad móvil", v.placa || "Sin unidad móvil"],
                  ["Centro de costo", v.centro_costo],
                  ["Ruta de trabajo", ruta.data?.nombre],
                  ["Destino o motivo", v.destino_tercero],
                ]}
              />
            </section>
          )}
          <section className="vale-qr">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={
                "Abrir consulta del vale " +
                v.codigo_vale +
                " (" +
                v.zonal +
                ")"
              }
            >
              <Qr url={url} />
            </a>
            <div>
              <h3>QR del vale</h3>
              <p>
                Escanéalo desde Registrar atención o abre el enlace para
                consultar el vale.
              </p>
            </div>
          </section>
          <ValeDetailSection title="Emisión" icon={FileText}>
            <ValeDetailFacts
              items={[
                ["Fecha de emisión", date(v.fecha_emision)],
                ["Proveedor", v.grifo],
                ["RUC", v.cod_proveedor],
                ["Contrato", v.nrocontrato || "Sin contrato"],
                ["Tercero", v.tercero],
                ["DNI del tercero", v.documento_tercero],
                ["Destino o motivo", v.destino_tercero],
              ]}
            />
          </ValeDetailSection>
          <ValeDetailSection title="Combustible" icon={Droplet}>
            <ValeDetailFacts
              items={[
                ["Suministro", v.suministro],
                ["Cantidad emitida", qty(v.cantidad_emitida) + " gal"],
                ["Precio referencial por galón", money(v.precio_referencial)],
                ["Importe estimado", money(v.importe_estimado)],
              ]}
            />
          </ValeDetailSection>
          <ValeDetailSection title="Asignación" icon={UserRound}>
            <ValeDetailFacts
              items={[
                ["Trabajador", v.trabajador],
                [
                  "DNI",
                  v.dni_trabajador ||
                    "Se verifica con el documento del conductor",
                ],
                ["Unidad organizativa", v.unidad_organizativa],
                ["Centro de costo", v.centro_costo],
                ["Localidad del centro", v.localidad_centro],
                ["Ubicación de referencia", v.referencia_ubicacion_centro],
                ["Zonal", v.zonal],
                ["Localidad", v.localidad],
                ["Unidad móvil", v.placa || "Sin unidad móvil"],
                ["Zonal base de la unidad", v.zonal_base_unidad],
              ]}
            />
          </ValeDetailSection>
          {(v.fecha_consumo || v.estado_vale === 3) && (
            <ValeDetailSection title="Atención registrada" icon={Receipt}>
              <ValeDetailFacts
                items={[
                  [
                    "Fecha de consumo",
                    v.fecha_consumo ? date(v.fecha_consumo) : "Sin registro",
                  ],
                  ["Ticket del grifo", v.ticket],
                  [
                    "Cantidad consumida",
                    v.cantidad_consumida != null
                      ? qty(v.cantidad_consumida) + " gal"
                      : null,
                  ],
                  [
                    "Precio real por galón",
                    v.precio_real != null ? money(v.precio_real) : null,
                  ],
                  [
                    "Precio sugerido",
                    v.precio_sugerido != null ? money(v.precio_sugerido) : null,
                  ],
                  [
                    "Atendido por",
                    v.responsables?.find((e) => e.accion === "ATENCION")
                      ?.nombre || "Sin registro",
                  ],
                  [
                    "Fecha de registro",
                    v.responsables?.find((e) => e.accion === "ATENCION")?.fecha
                      ? date(
                          v.responsables.find((e) => e.accion === "ATENCION")!
                            .fecha,
                        )
                      : null,
                  ],
                ]}
              />
              {v.importe != null && (
                <div className="vale-detail-amount">
                  <span>Importe real de atención</span>
                  <strong>{money(v.importe)}</strong>
                </div>
              )}
              <ValeDetailFacts
                items={[["Factura", v.factura_numero || "Sin asociar"]]}
              />
            </ValeDetailSection>
          )}
          {(v.observacion_anulacion || v.estado_vale === 4) && (
            <ValeDetailSection title="Anulación" icon={CircleSlash}>
              <ValeDetailFacts
                items={[
                  [
                    "Fecha",
                    v.responsables?.find((e) => e.accion === "ANULACION")?.fecha
                      ? date(
                          v.responsables.find((e) => e.accion === "ANULACION")!
                            .fecha,
                        )
                      : null,
                  ],
                  ["Motivo", v.observacion_anulacion || "Sin registro"],
                ]}
              />
            </ValeDetailSection>
          )}
          <RutaDelVale ruta={ruta.data} error={ruta.error} />
          <ValeDetailSection title="Responsables" icon={History}>
            <ol className="vale-history">
              {v.responsables?.map((e) => (
                <li key={e.accion}>
                  <span>
                    {{
                      EMISION: "Registrado por",
                      AUTORIZACION: "Autorizado por",
                      ATENCION: "Atendido por",
                      FACTURA: "Factura asociada por",
                      ANULACION: "Anulado por",
                    }[e.accion] || e.accion}
                  </span>
                  <strong>{e.nombre}</strong>
                  <time dateTime={e.fecha}>
                    {date(e.fecha)}{" "}
                    {new Date(e.fecha).toLocaleTimeString("es-PE", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "America/Lima",
                    })}
                  </time>
                </li>
              ))}
            </ol>
          </ValeDetailSection>
          <ValeDetailSection title="Observación" icon={MessageSquare}>
            <p className="vale-note">{v.observacion || "Sin observación"}</p>
          </ValeDetailSection>
        </div>
        <SheetFooter
          className={
            "vale-detail-footer" +
            (puedeAutorizar ? " vale-detail-autorizar" : "")
          }
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => openPdf(v)}
            disabled={latest.isFetching || !!latest.error}
          >
            <FileText /> Ver PDF
          </Button>
          {onAttend && v.estado_vale === 1 && (
            <Button onClick={() => onAttend(v)}>Registrar atención</Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          {puedeAutorizar && (
            <Button
              type="button"
              disabled={latest.isFetching || !!latest.error || !latest.data}
              onClick={() => onAuthorize(v)}
            >
              <CheckCircle2 aria-hidden="true" /> Autorizar vale
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
