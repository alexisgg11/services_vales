import { useId } from "react";
import { Check, ChevronDown } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { Button } from "@/components/ui/button";
import type { ContextoRutas } from "@/lib/types";

export function SelectorOperativosRuta({
  operativos,
  seleccionados,
  disabled,
  onChange,
}: {
  operativos: ContextoRutas["trabajadores"];
  seleccionados: number[];
  disabled?: boolean;
  onChange: (id: number, seleccionado: boolean) => void;
}) {
  const etiqueta = useId();
  const opciones = [
    ...operativos,
    ...seleccionados
      .filter((id) => !operativos.some((operativo) => operativo.id === id))
      .map((id) => ({ id, nombre: "Operativo no disponible" })),
  ];
  const resumen = !opciones.length
    ? "Sin operativos activos"
    : seleccionados.length === 1
      ? opciones.find((operativo) => operativo.id === seleccionados[0])!.nombre
      : seleccionados.length
        ? seleccionados.length + " operativos seleccionados"
        : "Seleccionar operativos";

  return (
    <div className="route-worker-field">
      <span id={etiqueta}>Operativos asignados</span>
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild>
          <Button
            type="button"
            variant="outline"
            className="route-worker-trigger"
            aria-labelledby={etiqueta + " " + etiqueta + "-seleccion"}
            disabled={disabled || !opciones.length}
          >
            <span id={etiqueta + "-seleccion"}>{resumen}</span>
            <ChevronDown aria-hidden="true" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            aria-label="Operativos de la zonal"
            className="route-location-menu route-workers-menu"
            align="start"
            sideOffset={6}
            collisionPadding={12}
          >
            {opciones.map(({ id, nombre }) => (
              <DropdownMenu.CheckboxItem
                key={id}
                checked={seleccionados.includes(id)}
                disabled={disabled}
                onCheckedChange={(checked) => onChange(id, checked)}
                onSelect={(evento) => evento.preventDefault()}
              >
                <span className="route-worker-check" aria-hidden="true">
                  <DropdownMenu.ItemIndicator>
                    <Check size={13} />
                  </DropdownMenu.ItemIndicator>
                </span>
                <span>{nombre}</span>
              </DropdownMenu.CheckboxItem>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
