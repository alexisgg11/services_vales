import { createPortal } from "react-dom";
import { useState } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Trash2,
} from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/formularios/campos";
import { origenValido } from "@/lib/geografia/coordenadas";
import {
  seleccionarCentro,
  type CentroRuta,
  type ModoPunto,
  type ParadaBorrador,
} from "./rutas-borrador";

interface AccionesParada {
  onAlternar: (clave: number) => void;
  onQuitar: (clave: number) => void;
  onActualizar: (parada: ParadaBorrador) => void;
  onUbicar: (parada: ParadaBorrador, modo: ModoPunto) => void;
}

interface ListaProps extends AccionesParada {
  id: string;
  paradas: ParadaBorrador[];
  centros: CentroRuta[];
  activa?: number;
  ubicando: boolean;
  guardando: boolean;
  onOrdenar: (paradas: ParadaBorrador[]) => void;
  onArrastre: (arrastrando: boolean) => void;
}

export function ListaParadasRuta({
  id,
  paradas,
  centros,
  activa,
  ubicando,
  guardando,
  onOrdenar,
  onArrastre,
  ...acciones
}: ListaProps) {
  const [arrastrada, setArrastrada] = useState<UniqueIdentifier | null>(null);
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const posicion = (clave: UniqueIdentifier) =>
    paradas.findIndex((p) => p.clave === clave) + 1;
  const paradaArrastrada = paradas.find((p) => p.clave === arrastrada);

  function terminarArrastre() {
    setArrastrada(null);
    onArrastre(false);
  }

  function soltar({ active, over }: DragEndEvent) {
    terminarArrastre();
    if (!over || over.id === active.id) return;
    const desde = posicion(active.id) - 1;
    const hasta = posicion(over.id) - 1;
    if (desde >= 0 && hasta >= 0) onOrdenar(arrayMove(paradas, desde, hasta));
  }

  return (
    <DndContext
      id={id}
      sensors={sensores}
      collisionDetection={closestCenter}
      modifiers={[({ transform }) => ({ ...transform, x: 0 })]}
      onDragStart={({ active }) => {
        setArrastrada(active.id);
        onArrastre(true);
      }}
      onDragEnd={soltar}
      onDragCancel={terminarArrastre}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Pulsa Espacio para tomar la parada. Usa las flechas para moverla. Pulsa Espacio para soltarla o Escape para cancelar.",
        },
        announcements: {
          onDragStart: ({ active }) =>
            `Tomaste la parada ${posicion(active.id)}.`,
          onDragOver: ({ over }) =>
            over ? `Posición ${posicion(over.id)}.` : undefined,
          onDragEnd: ({ over }) =>
            over
              ? `Parada movida a la posición ${posicion(over.id)}.`
              : undefined,
          onDragCancel: () => "Cambio de orden cancelado.",
        },
      }}
    >
      <SortableContext
        items={paradas.map((p) => p.clave)}
        strategy={verticalListSortingStrategy}
      >
        <ol
          className="route-stop-list"
          role="list"
          aria-label="Paradas en orden de visita"
        >
          {paradas.map((parada, i) => (
            <FilaParada
              key={parada.clave}
              id={`${id}-parada-${parada.clave}`}
              parada={parada}
              orden={i + 1}
              abierta={parada.clave === activa}
              movible={paradas.length > 1}
              ubicando={ubicando}
              guardando={guardando}
              centros={centros}
              {...acciones}
            />
          ))}
        </ol>
      </SortableContext>
      {createPortal(
        <DragOverlay dropAnimation={null} zIndex={1100}>
          {paradaArrastrada && (
            <div className="route-stop-drag-preview" aria-hidden="true">
              <GripVertical size={16} />
              {paradaArrastrada.nombre.trim() ||
                `Parada ${posicion(paradaArrastrada.clave)}`}
            </div>
          )}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}

function FilaParada({
  id,
  parada,
  orden,
  abierta,
  movible,
  ubicando,
  guardando,
  centros,
  onAlternar,
  onQuitar,
  onActualizar,
  onUbicar,
}: AccionesParada & {
  id: string;
  parada: ParadaBorrador;
  orden: number;
  abierta: boolean;
  movible: boolean;
  ubicando: boolean;
  guardando: boolean;
  centros: CentroRuta[];
}) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: parada.clave,
    disabled: !movible || ubicando || guardando,
  });
  const nombre = parada.nombre.trim();
  const centro = centros.find(({ codigo }) => codigo === parada.centro);
  const direccion =
    centro?.punto &&
    parada.punto?.latitud === centro.punto.latitud &&
    parada.punto.longitud === centro.punto.longitud
      ? centro.direccion
      : undefined;
  const estado =
    !parada.punto || !origenValido(parada.punto)
      ? "Falta ubicar"
      : !nombre
        ? "Falta nombre"
        : "Ubicada";
  const cambiarPunto = (
    <Button
      type="button"
      variant="outline"
      className="route-location-button"
      aria-label="Cambiar punto"
      title="Cambiar punto"
      disabled={ubicando || guardando}
      onClick={parada.centro ? undefined : () => onUbicar(parada, "libre")}
    >
      <ArrowLeftRight aria-hidden="true" />
    </Button>
  );
  return (
    <li
      ref={setNodeRef}
      className="route-stop-item"
      data-expanded={abierta}
      data-dragging={isDragging}
      style={{
        transform: transform
          ? `translate3d(0, ${transform.y}px, 0)`
          : undefined,
        transition,
      }}
    >
      <div className="route-stop-header">
        {movible ? (
          <Button
            type="button"
            variant="ghost"
            className="route-stop-handle"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Mover parada ${orden}`}
            title="Arrastrar para cambiar el orden"
            disabled={ubicando || guardando}
          >
            <GripVertical aria-hidden="true" />
            <span className="route-stop-number" aria-hidden="true">
              {orden}
            </span>
          </Button>
        ) : (
          <span className="route-stop-handle" aria-hidden="true">
            <span className="route-stop-number">{orden}</span>
          </span>
        )}
        <Button
          id={id}
          type="button"
          variant="ghost"
          className="route-stop-summary"
          aria-expanded={abierta}
          aria-controls={`${id}-contenido`}
          aria-describedby={`${id}-estado`}
          aria-label={`Parada ${orden}${nombre ? `: ${nombre}` : ""}`}
          onClick={() => onAlternar(parada.clave)}
        >
          <span className="route-stop-name">
            <strong>{nombre || `Parada ${orden}`}</strong>
            <Badge
              id={`${id}-estado`}
              className="route-stop-status"
              data-located={estado === "Ubicada"}
            >
              {estado}
            </Badge>
          </span>
          {abierta ? (
            <ChevronUp aria-hidden="true" />
          ) : (
            <ChevronDown aria-hidden="true" />
          )}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="route-stop-remove"
          aria-label={`Eliminar parada ${orden}`}
          title="Eliminar parada"
          onClick={() => onQuitar(parada.clave)}
        >
          <Trash2 />
        </Button>
      </div>
      <div id={`${id}-contenido`} hidden={!abierta}>
        {abierta && (
          <fieldset className="route-stop-editor" disabled={ubicando}>
            <div className="route-location-controls">
              <Field label="Centro de costo">
                <select
                  value={parada.centro ?? ""}
                  aria-describedby={direccion ? `${id}-direccion` : undefined}
                  onChange={(e) =>
                    onActualizar(
                      seleccionarCentro(parada, e.target.value, centros),
                    )
                  }
                >
                  <option value="" disabled hidden>
                    Sin centro de costo
                  </option>
                  {centros.map((centro) => (
                    <option key={centro.codigo} value={centro.codigo}>
                      {centro.nombre}
                      {centro.localidad ? " — " + centro.localidad : ""}
                    </option>
                  ))}
                </select>
              </Field>
              {parada.centro ? (
                <DropdownMenu.Root modal={false}>
                  <DropdownMenu.Trigger asChild>
                    {cambiarPunto}
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      className="route-location-menu"
                      align="end"
                      sideOffset={6}
                      collisionPadding={12}
                    >
                      <DropdownMenu.Item
                        onSelect={() => onUbicar(parada, "centro")}
                      >
                        {parada.punto ? "Ajustar centro" : "Ubicar centro"}
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onSelect={() => onUbicar(parada, "libre")}
                      >
                        Marcar punto libre
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              ) : (
                cambiarPunto
              )}
            </div>
            {direccion && (
              <p id={`${id}-direccion`} className="route-stop-address muted">
                {direccion}
              </p>
            )}
            <Field label="Nombre de la parada">
              <Input
                maxLength={150}
                value={parada.nombre}
                onChange={(e) =>
                  onActualizar({ ...parada, nombre: e.target.value })
                }
              />
            </Field>
          </fieldset>
        )}
      </div>
    </li>
  );
}
