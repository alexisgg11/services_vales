import {
  createContext,
  useContext,
  useState,
  type ReactNode,
  useId,
  useRef,
  useLayoutEffect,
} from "react";
import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FileText,
  MapPin,
  Ticket,
  LoaderCircle,
  Droplet,
  UserRound,
  Receipt,
  CircleSlash,
  History,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { InfoPopover } from "@/components/info-popover";
import {
  ValeCardLink,
  type SeleccionTactil,
} from "@/components/vale-card-link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { api, date, money, qty, states } from "@/lib/api";
import type { RutaTrabajo, Vale } from "@/lib/types";
import { contextoConsulta, detalleValeConsulta } from "@/lib/consultas";
import { puedeAutorizarVale } from "@/lib/permisos";
import { useValePdf } from "@/components/vale-pdf";
import QRCode from "qrcode";
import { RutaDelVale } from "@/components/vale-ruta";
import { useEffect } from "react";

export function useData() {
  return useQuery(contextoConsulta);
}
export function useRefresh() {
  const cache = useQueryClient();
  return async (...claves: QueryKey[]) => {
    if (claves.length === 0) return cache.invalidateQueries();
    await Promise.all(
      claves.map((queryKey) => cache.invalidateQueries({ queryKey })),
    );
  };
}
export function Field({
  label,
  children,
  hint,
  help,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  help?: string;
}) {
  const id = useId(),
    controlArea = useRef<HTMLDivElement>(null),
    [controlId, setControlId] = useState(id);
  useLayoutEffect(() => {
    const control = controlArea.current?.querySelector<HTMLElement>(
      'input,select,textarea,[role="combobox"]',
    );
    if (control) {
      if (!control.id) control.id = id;
      setControlId(control.id);
      if ((hint || help) && !control.getAttribute("aria-describedby"))
        control.setAttribute("aria-describedby", id + "-hint");
    }
  }, [children, id, hint, help]);
  return (
    <div className="field">
      <div className="field-label">
        <Label htmlFor={controlId}>{label}</Label>
        {help && (
          <span className="field-help">
            <InfoPopover
              title={"Información de " + label.toLocaleLowerCase("es-PE")}
            >
              <p>{help}</p>
            </InfoPopover>
          </span>
        )}
      </div>
      <div ref={controlArea}>{children}</div>
      {hint && <small id={id + "-hint"}>{hint}</small>}
      {!hint && help && (
        <span className="sr-only" id={id + "-hint"}>
          {help}
        </span>
      )}
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <Ticket aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}
export function ErrorText({ error }: { error: unknown }) {
  return error ? (
    <p className="error" role="alert">
      {error instanceof Error ? error.message : String(error)}
    </p>
  ) : null;
}
export function Busy() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" /> Cargando Vales
    </div>
  );
}
export function Search({
  value,
  onChange,
  placeholder = "Buscar por código, trabajador o ticket",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
    />
  );
}
export function matches(v: Vale, q: string) {
  return [v.codigo_vale, v.trabajador, v.ticket, v.zonal, v.placa]
    .join(" ")
    .toLowerCase()
    .includes(q.trim().toLowerCase());
}
export function State({ vale }: { vale: Vale }) {
  return (
    <Badge variant="outline" className={"state state-" + vale.estado_vale}>
      {states[vale.estado_vale]}
    </Badge>
  );
}
interface ModalState {
  title: string;
  body: ReactNode;
  action?: () => Promise<void>;
  label?: string;
  cancelLabel?: string;
  success?: boolean;
  destructive?: boolean;
}
const ModalContext = createContext<(m: ModalState) => void>(() => {});
export function useModal() {
  return useContext(ModalContext);
}
export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  const dialogRoot = useRef<HTMLDivElement>(null);
  const show = (m: ModalState) => {
    setError(undefined);
    setModal(m);
  };
  return (
    <ModalContext.Provider value={show}>
      {children}
      <Dialog
        open={!!modal}
        onOpenChange={(o) => {
          if (!o && !busy) setModal(null);
        }}
      >
        <DialogContent
          ref={dialogRoot}
          className="modal"
          showCloseButton={!busy}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            dialogRoot.current?.focus({ preventScroll: true });
          }}
        >
          <DialogHeader>
            <div className={"notice-icon " + (modal?.success ? "success" : "")}>
              {modal?.success ? (
                <CheckCircle2 size={48} />
              ) : (
                <AlertCircle size={48} />
              )}
            </div>
            <DialogTitle>{modal?.title}</DialogTitle>
          </DialogHeader>
          <div className="modal-body">
            <DialogDescription asChild>
              <div>{modal?.body}</div>
            </DialogDescription>
            <ErrorText error={error} />
          </div>
          <div className="actions">
            {modal?.action && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                {modal.cancelLabel || "Volver"}
              </Button>
            )}
            <Button
              variant={modal?.destructive ? "destructive" : "default"}
              disabled={busy}
              onClick={async () => {
                if (!modal?.action) {
                  setModal(null);
                  return;
                }
                setBusy(true);
                try {
                  await modal.action();
                  setModal(null);
                } catch (e) {
                  setError(e);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? <LoaderCircle className="spin" /> : null}
              {modal?.action ? modal.label || "Confirmar" : "Entendido"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ModalContext.Provider>
  );
}
export function Qr({ url }: { url: string }) {
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
