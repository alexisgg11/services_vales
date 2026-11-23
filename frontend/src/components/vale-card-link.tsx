import { useEffect, useRef, type PointerEvent } from "react";

export type SeleccionTactil = {
  marcada?: boolean;
  mantener: () => void;
};

type Pulsacion = {
  id: number;
  x: number;
  y: number;
  temporizador: number;
};

export function ValeCardLink({
  etiqueta,
  disabled,
  abrir,
  seleccion,
}: {
  etiqueta: string;
  disabled?: boolean;
  abrir: () => void;
  seleccion?: SeleccionTactil;
}) {
  const pulsacion = useRef<Pulsacion | null>(null);

  useEffect(() => {
    return () => window.clearTimeout(pulsacion.current?.temporizador);
  }, []);

  function cancelar(evento: PointerEvent<HTMLButtonElement>) {
    if (pulsacion.current?.id !== evento.pointerId) return;
    window.clearTimeout(pulsacion.current.temporizador);
    pulsacion.current = null;
  }

  function iniciar(evento: PointerEvent<HTMLButtonElement>) {
    if (!seleccion || !evento.isPrimary || evento.button !== 0) return;
    window.clearTimeout(pulsacion.current?.temporizador);
    pulsacion.current = {
      id: evento.pointerId,
      x: evento.clientX,
      y: evento.clientY,
      temporizador: window.setTimeout(() => {
        pulsacion.current = null;
        seleccion.mantener();
      }, 500),
    };
  }

  function mover(evento: PointerEvent<HTMLButtonElement>) {
    const inicio = pulsacion.current;
    if (
      inicio?.id === evento.pointerId &&
      Math.hypot(evento.clientX - inicio.x, evento.clientY - inicio.y) > 10
    ) {
      cancelar(evento);
    }
  }

  return (
    <button
      type="button"
      className="vale-card-link"
      aria-label={etiqueta}
      aria-pressed={seleccion?.marcada}
      data-seleccion-tactil={seleccion ? "" : undefined}
      disabled={disabled}
      onPointerDown={iniciar}
      onPointerMove={mover}
      onPointerUp={cancelar}
      onPointerCancel={cancelar}
      onPointerLeave={cancelar}
      onContextMenu={
        seleccion ? (evento) => evento.preventDefault() : undefined
      }
      onClick={abrir}
    />
  );
}
