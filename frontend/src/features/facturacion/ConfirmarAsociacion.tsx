import { useRef } from "react";
import { ArrowLeftRight, Link, LoaderCircle, Receipt } from "lucide-react";
import { ErrorText } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Factura, Vale } from "@/lib/types";
import {
  DatosFactura,
  TotalAsociacion,
  ValesPorAsociar,
} from "./DatosAsociacion";

export interface AsociacionPendiente {
  factura: Factura;
  grifo: string;
  vales: Vale[];
  total: number;
}

export function ConfirmarAsociacion({
  asociacion,
  vigente,
  ocupado,
  error,
  onOpenVale,
  onCancelar,
  onConfirmar,
}: {
  asociacion: AsociacionPendiente;
  vigente: boolean;
  ocupado: boolean;
  error: unknown;
  onOpenVale: (vale: Vale) => void;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  const { factura, grifo, vales, total } = asociacion;
  const disparador = useRef(document.activeElement);
  const dialogo = useRef<HTMLDivElement>(null);
  return (
    <Dialog
      open
      onOpenChange={(abierto) => !abierto && !ocupado && onCancelar()}
    >
      <DialogContent
        ref={dialogo}
        className="factura-confirmacion"
        showCloseButton={!ocupado}
        onOpenAutoFocus={(evento) => {
          evento.preventDefault();
          dialogo.current?.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={(evento) => {
          evento.preventDefault();
          const origen = disparador.current;
          if (origen instanceof HTMLElement && origen.isConnected) {
            origen.focus({ preventScroll: true });
          }
        }}
      >
        <DialogHeader className="factura-dialogo-cabecera">
          <DialogTitle>Confirmar asociación</DialogTitle>
          <DialogDescription className="sr-only">
            Revisa la factura y los vales antes de guardar la asociación.
          </DialogDescription>
        </DialogHeader>
        <div className="factura-dialogo-cuerpo">
          <section className="factura-confirmacion-documento">
            <div className="factura-tarjeta-titulo">
              <Receipt aria-hidden="true" />
              <h3>
                {factura.serie}-{factura.numero}
              </h3>
            </div>
            <DatosFactura factura={factura} grifo={grifo} />
          </section>
          <div className="factura-confirmacion-totales">
            <TotalAsociacion titulo="Total de vales" importe={total} />
            <ArrowLeftRight aria-hidden="true" />
            <TotalAsociacion
              titulo="Importe de factura"
              importe={factura.total}
            />
          </div>
          <div className="factura-confirmacion-vales">
            <h3>Vales por asociar</h3>
            <Badge
              variant="secondary"
              className="factura-confirmacion-cantidad"
            >
              {vales.length}
            </Badge>
          </div>
          <ValesPorAsociar vales={vales} onOpen={onOpenVale} />
        </div>
        <DialogFooter className="factura-dialogo-pie">
          <ErrorText error={error} />
          {!vigente && (
            <p className="warning" role="status">
              Actualiza la revisión. La factura o los vales cambiaron.
            </p>
          )}
          <div className="factura-dialogo-acciones">
            <Button
              type="button"
              variant="outline"
              disabled={ocupado}
              onClick={onCancelar}
            >
              Volver
            </Button>
            <Button
              type="button"
              disabled={!vigente || ocupado}
              onClick={onConfirmar}
            >
              {ocupado ? (
                <LoaderCircle className="spin" aria-hidden="true" />
              ) : (
                <Link aria-hidden="true" />
              )}
              {ocupado ? "Asociando" : "Asociar factura"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
