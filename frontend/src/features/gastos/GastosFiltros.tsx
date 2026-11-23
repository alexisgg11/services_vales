import { useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { Field } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { today } from "@/lib/api";
import {
  etiquetaRango,
  periodos,
  rangoPeriodo,
  type CampoFiltroGastos,
  type FiltrosGastos,
  type Periodo,
} from "./gastos-datos";

export function GastosFiltros({
  filtros,
  campos,
  onChange,
}: {
  filtros: FiltrosGastos;
  campos: readonly CampoFiltroGastos[];
  onChange: (filtros: FiltrosGastos) => void;
}) {
  const [panel, setPanel] = useState<"fechas" | "filtros" | null>(null);
  const [borrador, setBorrador] = useState(filtros);
  const disparador = useRef<HTMLElement | null>(null);
  const botonPeriodo = useRef<HTMLButtonElement>(null);
  const activos = campos.filter(({ dimension }) => filtros[dimension]);
  const fechas = panel === "fechas";
  const nombrePeriodo = periodos.find(([id]) => id === filtros.periodo)?.[1];

  function abrir(vista: "fechas" | "filtros", control: HTMLElement | null) {
    disparador.current = control;
    setBorrador(filtros);
    setPanel(vista);
  }

  function seleccionarPeriodo(periodo: Periodo) {
    if (periodo === "personalizado") {
      abrir("fechas", botonPeriodo.current);
    } else if (periodo !== filtros.periodo) {
      onChange({ ...filtros, periodo, ...rangoPeriodo(periodo, today()) });
    }
  }

  return (
    <>
      <section className="gastos-filtros" aria-label="Filtros de gastos">
        <div className="gastos-filtros-linea">
          <div className="gastos-filtros-acciones">
            <DropdownMenu.Root modal={false}>
              <DropdownMenu.Trigger asChild>
                <Button
                  type="button"
                  ref={botonPeriodo}
                  variant="outline"
                  className="gastos-periodo-trigger"
                  aria-label={"Período de consumo, " + nombrePeriodo}
                >
                  <CalendarDays aria-hidden="true" />
                  <span>{nombrePeriodo}</span>
                  <ChevronDown aria-hidden="true" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="gastos-periodos-menu"
                  align="start"
                  sideOffset={6}
                  onCloseAutoFocus={(e) => {
                    if (fechas) e.preventDefault();
                  }}
                >
                  {periodos.map(([id, etiqueta]) => (
                    <DropdownMenu.Item
                      key={id}
                      onSelect={() => seleccionarPeriodo(id)}
                    >
                      <span>{etiqueta}</span>
                      {id === filtros.periodo && (
                        <Check size={16} aria-label="Seleccionado" />
                      )}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <Button
              type="button"
              variant="outline"
              onClick={(e) => abrir("filtros", e.currentTarget)}
            >
              <SlidersHorizontal aria-hidden="true" />
              Filtros
              {activos.length > 0 && (
                <span className="gastos-filtros-cuenta">{activos.length}</span>
              )}
            </Button>
          </div>
          <span className="gastos-periodo-fechas">
            {etiquetaRango(filtros)}
          </span>
        </div>
        {activos.length > 0 && (
          <ul className="gastos-filtros-activos" aria-label="Filtros aplicados">
            {activos.map(({ dimension, etiqueta, opciones }) => {
              const nombre =
                opciones.find(([id]) => id === filtros[dimension])?.[1] ??
                filtros[dimension];
              return (
                <li key={dimension}>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={`Quitar filtro de ${etiqueta.toLowerCase()}, ${nombre}`}
                    onClick={() => onChange({ ...filtros, [dimension]: "" })}
                  >
                    {nombre}
                    <X aria-hidden="true" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Sheet
        open={!!panel}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <SheetContent
          className="gastos-filtros-panel"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            disparador.current?.focus();
          }}
        >
          <SheetHeader>
            <SheetTitle>
              {fechas ? "Período personalizado" : "Filtros de gastos"}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {fechas
                ? "Selecciona las fechas de consumo."
                : "Elige los filtros para los vales facturados."}
            </SheetDescription>
          </SheetHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (fechas && borrador.desde > borrador.hasta) return;
              onChange(
                fechas ? { ...borrador, periodo: "personalizado" } : borrador,
              );
              setPanel(null);
            }}
          >
            <div className="gastos-filtros-campos">
              {fechas ? (
                <>
                  <Field label="Desde">
                    <Input
                      type="date"
                      required
                      min="0001-01-01"
                      max="9999-12-31"
                      value={borrador.desde}
                      onChange={(e) =>
                        setBorrador({ ...borrador, desde: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Hasta">
                    <Input
                      type="date"
                      required
                      min={borrador.desde || "0001-01-01"}
                      max="9999-12-31"
                      value={borrador.hasta}
                      onChange={(e) =>
                        setBorrador({ ...borrador, hasta: e.target.value })
                      }
                    />
                  </Field>
                </>
              ) : (
                campos.map(({ dimension, etiqueta, todas, opciones }) => (
                  <Field key={dimension} label={etiqueta}>
                    <select
                      value={borrador[dimension]}
                      onChange={(e) =>
                        setBorrador({
                          ...borrador,
                          [dimension]: e.target.value,
                        })
                      }
                    >
                      <option value="">{todas}</option>
                      {opciones.map(([valor, nombre]) => (
                        <option key={valor} value={valor}>
                          {nombre}
                        </option>
                      ))}
                    </select>
                  </Field>
                ))
              )}
            </div>
            <SheetFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPanel(null)}
              >
                Cancelar
              </Button>
              <Button type="submit">
                {fechas ? "Aplicar período" : "Aplicar filtros"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
