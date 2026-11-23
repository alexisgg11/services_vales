import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorText, Field, ValeCard } from "@/components/common";
import { api, ApiError, today, money, qty } from "@/lib/api";
import type { Vale } from "@/lib/types";
import { mensajeEstado } from "./busqueda-atencion";

interface IdentidadAtencion {
  nombre: string;
}

interface RevisionDespacho {
  fecha: string;
  cantidad: number;
  precio: number;
  sugerido: number;
}

export function FormularioDespacho({
  vale,
  onOpen,
  onClose,
  onSaved,
}: {
  vale: Vale;
  onOpen: (v: Vale) => void;
  onClose: () => void;
  onSaved: (v: Vale) => void;
}) {
  const ruta = "/api/v1/atencion/vales/" + vale.id_qr;
  const esTercero = vale.codigo_tercero != null;
  const [dni, setDni] = useState("");
  const [identidad, setIdentidad] = useState<IdentidadAtencion>();
  const [documentoRevisado, setDocumentoRevisado] = useState(false);
  const [validando, setValidando] = useState(false);
  const [errorDni, setErrorDni] = useState<unknown>();
  const [fecha, setFecha] = useState(today);
  const [galones, setGalones] = useState("");
  const [precioEditado, setPrecioEditado] = useState<string>();
  const [revision, setRevision] = useState<RevisionDespacho>();
  const [errorConfirmar, setErrorConfirmar] = useState<unknown>();
  const [estadoConfirmar, setEstadoConfirmar] = useState<
    "consultar" | "bloqueado"
  >();
  const [ocupado, setOcupado] = useState(false);
  const solicitudDni = useRef<AbortController | null>(null);
  const enviando = useRef(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  const entradaDni = useRef<HTMLInputElement>(null);
  const paso = revision ? "confirmacion" : identidad ? "despacho" : "identidad";
  const etiquetaDni = esTercero ? "DNI del tercero" : "DNI del trabajador";
  const puedeValidar = dni.length === 8 && documentoRevisado && !validando;
  const fechaValida = fecha >= vale.fecha_emision && fecha <= today();
  const cotizacion = useQuery({
    queryKey: ["precio-atencion", vale.id_qr, fecha],
    queryFn: ({ signal }) =>
      api<{ precio: number; fuente: string }>(
        ruta + "/precio?fecha=" + fecha,
        undefined,
        signal,
      ),
    enabled: !!identidad && fechaValida,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const sugerido = cotizacion.data?.precio;
  const listo =
    !!identidad && fechaValida && sugerido != null && !cotizacion.error;
  const cantidad = Number(galones);
  const precio = Number(precioEditado ?? sugerido ?? 0);
  const total = Math.round(cantidad * precio * 100) / 100;
  const verificable =
    listo &&
    estadoConfirmar !== "bloqueado" &&
    cantidad > 0 &&
    cantidad <= vale.cantidad_emitida &&
    precio > 0;

  useEffect(() => () => solicitudDni.current?.abort(), []);

  useLayoutEffect(() => {
    const foco = paso === "identidad" ? entradaDni.current : titulo.current;
    foco?.focus({ preventScroll: true });
  }, [paso]);

  async function validar() {
    if (!puedeValidar || solicitudDni.current) return;
    const solicitud = new AbortController();
    solicitudDni.current = solicitud;
    setValidando(true);
    setErrorDni(undefined);
    try {
      const resultado = await api<IdentidadAtencion>(
        ruta + "/validar-dni",
        { dni },
        solicitud.signal,
      );
      if (!solicitud.signal.aborted) setIdentidad(resultado);
    } catch (e) {
      if (!solicitud.signal.aborted) setErrorDni(e);
    } finally {
      if (solicitudDni.current === solicitud) solicitudDni.current = null;
      if (!solicitud.signal.aborted) setValidando(false);
    }
  }

  function revisar() {
    if (!verificable || sugerido == null) return;
    setErrorConfirmar(undefined);
    setRevision({
      fecha,
      cantidad,
      precio,
      sugerido,
    });
  }

  async function consultarEstado(error?: unknown) {
    try {
      const actual = (
        await api<{ vale: Vale }>("/api/v1/documentos/" + vale.id_qr)
      ).vale;
      if (actual.estado_vale === 3 && actual.ticket) {
        onSaved(actual);
      } else if (actual.estado_vale !== 1 || actual.puede_atender === false) {
        setEstadoConfirmar("bloqueado");
        setErrorConfirmar(new Error(mensajeEstado(actual)));
      } else {
        setEstadoConfirmar(undefined);
        setErrorConfirmar(
          error instanceof ApiError && error.status > 0 && error.status < 500
            ? error
            : new Error(
                "El vale sigue autorizado. Revisa el despacho antes de confirmar de nuevo.",
              ),
        );
        void cotizacion.refetch();
      }
    } catch {
      setEstadoConfirmar("consultar");
      setErrorConfirmar(
        new Error(
          "Consulta el estado del vale cuando se recupere la conexión.",
        ),
      );
    }
  }

  async function confirmar() {
    if (!revision || !identidad || !documentoRevisado || enviando.current)
      return;
    enviando.current = true;
    setOcupado(true);
    setErrorConfirmar(undefined);
    try {
      if (estadoConfirmar === "consultar") {
        await consultarEstado();
        return;
      }
      const resultado = await api<{ vale: Vale }>(ruta + "/atencion", {
        fecha: revision.fecha,
        cantidad: revision.cantidad,
        precio: revision.precio,
        precioConfirmado:
          revision.precio !== revision.sugerido ? revision.sugerido : null,
        dniPresentado: dni,
        identidadVerificada: documentoRevisado,
      });
      onSaved(resultado.vale);
    } catch (e) {
      await consultarEstado(e);
    } finally {
      enviando.current = false;
      setOcupado(false);
    }
  }

  function volver() {
    if (revision) {
      setRevision(undefined);
    } else if (identidad) {
      setIdentidad(undefined);
      setDocumentoRevisado(false);
    } else {
      onClose();
    }
  }

  const enviarDeshabilitado = revision
    ? ocupado || estadoConfirmar === "bloqueado"
    : identidad
      ? !verificable
      : !puedeValidar;
  const accionConfirmar = ocupado
    ? "Verificando despacho"
    : estadoConfirmar === "consultar"
      ? "Consultar estado"
      : "Confirmar despacho";

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (open || ocupado) return;
        if (revision) setRevision(undefined);
        else onClose();
      }}
    >
      <DialogContent
        className="dialogo-despacho"
        showCloseButton={!ocupado}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (entradaDni.current ?? titulo.current)?.focus();
        }}
      >
        <DialogHeader className="dialogo-despacho-encabezado">
          <DialogTitle ref={titulo} tabIndex={-1}>
            {revision
              ? "Confirmar despacho"
              : identidad
                ? "Datos del despacho"
                : "Verificar identidad"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {revision
              ? "Revisa los datos del combustible antes de guardar el ticket."
              : identidad
                ? "Registra la fecha, los galones y el precio del despacho."
                : "Verifica que el DNI presentado corresponda a este vale."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="dialogo-despacho-formulario"
          onSubmit={(event) => {
            event.preventDefault();
            if (enviarDeshabilitado) return;
            if (revision) void confirmar();
            else if (identidad) revisar();
            else void validar();
          }}
        >
          <div key={paso} className="dialogo-despacho-cuerpo stack">
            <ValeCard
              vale={vale}
              onOpen={revision ? undefined : onOpen}
              datos={[
                [
                  esTercero ? "Tercero asignado" : "Trabajador asignado",
                  identidad?.nombre ??
                    (esTercero ? vale.tercero : vale.trabajador),
                ],
                [
                  revision ? "Combustible" : "Grifo",
                  revision ? vale.suministro : vale.grifo,
                ],
                [
                  revision ? "Galones autorizados" : "Combustible",
                  revision
                    ? qty(vale.cantidad_emitida) + " gal"
                    : vale.suministro,
                ],
                [
                  revision ? "Galones despachados" : "Máximo autorizado",
                  qty(revision?.cantidad ?? vale.cantidad_emitida) + " gal",
                ],
              ]}
            />
            {paso === "identidad" && (
              <div className="atencion-identidad">
                <Field label={etiquetaDni}>
                  <Input
                    ref={entradaDni}
                    inputMode="numeric"
                    maxLength={8}
                    autoComplete="off"
                    required
                    value={dni}
                    readOnly={validando}
                    aria-invalid={!!errorDni}
                    onChange={(e) => {
                      setDni(e.target.value.replace(/\D/g, ""));
                      setDocumentoRevisado(false);
                      setGalones("");
                      setPrecioEditado(undefined);
                      setErrorDni(undefined);
                    }}
                  />
                </Field>
                <label className="checkbox-line atencion-documento">
                  <input
                    type="checkbox"
                    checked={documentoRevisado}
                    onChange={(e) => setDocumentoRevisado(e.target.checked)}
                    disabled={validando}
                    required
                  />
                  Verifiqué el documento original del{" "}
                  {esTercero ? "tercero" : "trabajador"}.
                </label>
                <ErrorText error={errorDni} />
              </div>
            )}
            {paso === "despacho" && (
              <>
                <div className="form-grid atencion-campos">
                  <Field label="Fecha de consumo">
                    <Input
                      type="date"
                      min={vale.fecha_emision}
                      max={today()}
                      required
                      value={fecha}
                      onChange={(e) => {
                        setFecha(e.target.value);
                        setPrecioEditado(undefined);
                      }}
                    />
                  </Field>
                  <Field label="Galones despachados">
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={vale.cantidad_emitida}
                      inputMode="decimal"
                      required
                      value={galones}
                      onChange={(e) => setGalones(e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Precio real por galón"
                    help={
                      sugerido != null
                        ? (cotizacion.data?.fuente === "CONTRATO"
                            ? "Contrato "
                            : "Tarifa del día ") + money(sugerido)
                        : undefined
                    }
                  >
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      inputMode="decimal"
                      required
                      value={precioEditado ?? sugerido?.toFixed(2) ?? ""}
                      onChange={(e) => setPrecioEditado(e.target.value)}
                    />
                  </Field>
                </div>
                {cotizacion.isFetching && (
                  <p className="muted" role="status">
                    Consultando precio
                  </p>
                )}
                <ErrorText error={cotizacion.error} />
                {estadoConfirmar === "bloqueado" && (
                  <ErrorText error={errorConfirmar} />
                )}
              </>
            )}
            {revision && (
              <>
                <dl className="facts atencion-resumen-precio">
                  <div>
                    <dt>Precio por galón</dt>
                    <dd>{money(revision.precio)}</dd>
                  </div>
                  <div>
                    <dt>Importe real</dt>
                    <dd>
                      {money(
                        Math.round(revision.cantidad * revision.precio * 100) /
                          100,
                      )}
                    </dd>
                  </div>
                </dl>
                {revision.precio !== revision.sugerido && (
                  <p className="warning">
                    El precio sugerido era {money(revision.sugerido)} por galón.
                  </p>
                )}
                {revision.cantidad < vale.cantidad_emitida && (
                  <p className="muted">
                    El vale se cerrará con {qty(revision.cantidad)} galones.
                  </p>
                )}
                <ErrorText error={errorConfirmar} />
              </>
            )}
          </div>
          <DialogFooter className="dialogo-despacho-pie">
            {paso === "despacho" && (
              <div
                className="atencion-total atencion-total-pie"
                aria-live="polite"
              >
                <span>Importe real</span>
                <strong>{money(total)}</strong>
              </div>
            )}
            <div className="atencion-botones">
              <Button
                type="button"
                variant="outline"
                disabled={ocupado}
                onClick={volver}
              >
                Volver
              </Button>
              <Button type="submit" disabled={enviarDeshabilitado}>
                {(ocupado || validando) && (
                  <LoaderCircle className="spin" aria-hidden="true" />
                )}
                {revision
                  ? accionConfirmar
                  : identidad
                    ? "Revisar despacho"
                    : validando
                      ? "Validando"
                      : "Verificar DNI"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
