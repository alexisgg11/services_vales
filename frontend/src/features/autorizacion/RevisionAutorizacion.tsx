import { useRef } from "react";
import { CheckCircle2, LoaderCircle, X } from "lucide-react";
import { ErrorText, ValeCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cents, money, qty } from "@/lib/api";
import type { Vale } from "@/lib/types";

export interface Revision {
  vales: Vale[];
  individual: boolean;
}

export function RevisionAutorizacion({
  revision,
  cambios,
  fueraDelFiltro,
  ocupado,
  error,
  onClose,
  onRemove,
  onOpenDetail,
  onConfirm,
}: {
  revision: Revision;
  cambios: ReadonlyMap<string, number | null>;
  fueraDelFiltro: number;
  ocupado: boolean;
  error: unknown;
  onClose: () => void;
  onRemove: (id: string) => void;
  onOpenDetail: (vale: Vale) => void;
  onConfirm: () => void;
}) {
  const dialogo = useRef<HTMLDivElement>(null);
  const disparador = useRef(document.activeElement);
  const { vales, individual } = revision;
  const total = vales.reduce(
    (acumulado, v) => acumulado + cents(v.importe_estimado),
    0,
  );
  const cantidad = vales.length;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !ocupado) onClose();
      }}
    >
      <DialogContent
        ref={dialogo}
        className="revision-autorizacion"
        showCloseButton={!ocupado}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          dialogo.current?.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={(event) => {
          if (
            disparador.current instanceof HTMLElement &&
            disparador.current.isConnected
          ) {
            event.preventDefault();
            disparador.current.focus({ preventScroll: true });
          }
        }}
      >
        <DialogHeader className="revision-autorizacion-encabezado">
          <DialogTitle>
            {individual ? "Autorizar vale" : "Revisar selección"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Verifica la cantidad y el importe estimado antes de autorizar.
          </DialogDescription>
        </DialogHeader>
        <div className="revision-autorizacion-cuerpo">
          {!!fueraDelFiltro && (
            <p className="revision-aviso">
              {fueraDelFiltro === 1
                ? "1 vale seleccionado está fuera del filtro actual."
                : fueraDelFiltro +
                  " vales seleccionados están fuera del filtro actual."}
            </p>
          )}
          {!!cambios.size && (
            <p className="revision-aviso" role="alert">
              {individual
                ? "El estado de este vale cambió. Vuelve a la bandeja para revisar los pendientes."
                : "Revisa los cambios y retira los vales que ya no puedes autorizar."}
            </p>
          )}
          {cantidad ? (
            <ul
              className="revision-autorizacion-lista"
              aria-label="Vales de la selección"
            >
              {vales.map((v) => {
                const estado = cambios.get(v.id_vale);
                return (
                  <li key={v.id_vale}>
                    <div className="revision-vale-tarjeta">
                      <ValeCard
                        vale={
                          estado == null ? v : { ...v, estado_vale: estado }
                        }
                        onOpen={
                          individual || ocupado
                            ? undefined
                            : () => onOpenDetail(v)
                        }
                        datos={[
                          ["Trabajador", v.trabajador],
                          ["Grifo", v.grifo],
                          [
                            "Cantidad solicitada",
                            qty(v.cantidad_emitida) + " gal",
                          ],
                          ["Importe estimado", money(v.importe_estimado)],
                        ]}
                        accionCabecera={
                          !individual && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="revision-vale-quitar"
                              disabled={ocupado}
                              title="Quitar de la selección"
                              aria-label={
                                "Quitar vale " +
                                v.codigo_vale +
                                " de " +
                                v.zonal +
                                " de la selección"
                              }
                              onClick={() => {
                                onRemove(v.id_vale);
                                dialogo.current?.focus({ preventScroll: true });
                              }}
                            >
                              <X aria-hidden="true" />
                            </Button>
                          )
                        }
                      />
                      {estado === null && (
                        <p className="revision-vale-cambio">
                          Ya no está disponible
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>No quedan vales en la selección.</p>
          )}
          {!cambios.size && <ErrorText error={error} />}
        </div>
        <DialogFooter className="revision-autorizacion-pie">
          <div className="revision-autorizacion-total">
            <span>
              {cantidad === 1
                ? "Total estimado de 1 vale"
                : "Total estimado de " + cantidad + " vales"}
            </span>
            <strong>{money(total / 100)}</strong>
          </div>
          <div className="revision-autorizacion-acciones">
            <Button
              type="button"
              variant="outline"
              disabled={ocupado}
              onClick={onClose}
            >
              Volver
            </Button>
            <Button
              type="button"
              disabled={ocupado || !cantidad || cambios.size > 0}
              onClick={onConfirm}
            >
              {ocupado ? (
                <LoaderCircle className="spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 aria-hidden="true" />
              )}
              {ocupado
                ? "Autorizando"
                : cantidad <= 1
                  ? "Autorizar vale"
                  : "Autorizar " + cantidad + " vales"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
