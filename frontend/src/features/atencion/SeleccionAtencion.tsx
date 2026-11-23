import { useRef } from "react";
import { Eye, Fuel, LoaderCircle } from "lucide-react";
import { ErrorText } from "@/components/ui/feedback";
import { ValeCard } from "@/components/vales/TarjetaVale";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { money, qty } from "@/lib/api";
import type { Vale } from "@/lib/types";

export function SeleccionAtencion({
  vale,
  consultando,
  error,
  onAtender,
  onDetalle,
  onClose,
}: {
  vale: Vale;
  consultando: boolean;
  error: unknown;
  onAtender: (v: Vale) => void;
  onDetalle: (v: Vale) => void;
  onClose: () => void;
}) {
  const disparador = useRef(document.activeElement);
  const volverAlVale = useRef(false);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (open || consultando) return;
        volverAlVale.current = true;
        onClose();
      }}
    >
      <DialogContent
        className="dialogo-despacho"
        showCloseButton={!consultando}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const origen = disparador.current;
          if (
            volverAlVale.current &&
            origen instanceof HTMLElement &&
            origen.isConnected
          ) {
            origen.focus({ preventScroll: true });
          }
        }}
      >
        <DialogHeader className="dialogo-despacho-encabezado">
          <DialogTitle>¿Atender este vale?</DialogTitle>
          <DialogDescription className="sr-only">
            Opciones del vale {vale.codigo_vale} de {vale.zonal}.
          </DialogDescription>
        </DialogHeader>
        <div className="dialogo-despacho-cuerpo stack">
          <ValeCard
            vale={vale}
            datos={[
              [
                vale.codigo_tercero != null ? "Tercero" : "Trabajador",
                vale.tercero ?? vale.trabajador,
              ],
              ["Grifo", vale.grifo],
              [
                "Combustible",
                <>
                  {vale.suministro}
                  <small className="block">
                    {qty(vale.cantidad_emitida)} gal
                  </small>
                </>,
              ],
              ["Importe estimado", money(vale.importe_estimado)],
            ]}
          />
          <ErrorText error={error} />
        </div>
        <DialogFooter className="dialogo-despacho-pie atencion-seleccion-acciones">
          <Button
            type="button"
            variant="outline"
            disabled={consultando}
            onClick={() => onDetalle(vale)}
          >
            <Eye aria-hidden="true" /> Ver detalle
          </Button>
          <Button
            type="button"
            disabled={consultando}
            onClick={() => onAtender(vale)}
          >
            {consultando ? (
              <LoaderCircle className="spin" aria-hidden="true" />
            ) : (
              <Fuel aria-hidden="true" />
            )}
            {consultando ? "Consultando" : "Atender"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
