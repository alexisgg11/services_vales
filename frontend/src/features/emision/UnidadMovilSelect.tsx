import { Check, ChevronDown, ChevronUp, Truck } from "lucide-react";
import { Select } from "radix-ui";
import type { Unidad } from "@/lib/types";

interface Props {
  value: string;
  onChange: (value: string) => void;
  unidades: Unidad[];
  zonales: { id_zona: string; nom_zona: string }[];
}

const SIN_UNIDAD = "sin-unidad";

export function UnidadMovilSelect({
  value,
  onChange,
  unidades,
  zonales,
}: Props) {
  const selected = unidades.find((u) => String(u.codigo) === value);
  const nombreZonal = (codigo: string) =>
    zonales.find((z) => z.id_zona === codigo)?.nom_zona || codigo;

  return (
    <Select.Root
      value={selected ? String(selected.codigo) : SIN_UNIDAD}
      onValueChange={(v) => onChange(v === SIN_UNIDAD ? "" : v)}
    >
      <Select.Trigger className="unit-select-trigger" aria-label="Unidad móvil">
        <span className="unit-select-icon" aria-hidden="true">
          <Truck size={19} />
        </span>
        <Select.Value asChild>
          <span className="unit-select-text">
            <span className="unit-select-title">
              <strong>{selected?.placa || "Sin unidad móvil"}</strong>
              {selected && (
                <span className="unit-select-zonal">
                  {nombreZonal(selected.cod_zonal)}
                </span>
              )}
            </span>
            {selected && <small>{selected.descripcion}</small>}
          </span>
        </Select.Value>
        <Select.Icon asChild>
          <ChevronDown size={16} className="unit-select-chevron" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="unit-select-popup"
          position="popper"
          align="start"
          sideOffset={6}
          collisionPadding={12}
        >
          <Select.ScrollUpButton className="unit-select-scroll">
            <ChevronUp size={16} />
          </Select.ScrollUpButton>
          <Select.Viewport className="unit-select-options">
            <Select.Item
              value={SIN_UNIDAD}
              textValue="Sin unidad móvil"
              className="unit-select-option unit-select-none"
            >
              <Truck size={18} aria-hidden="true" />
              <Select.ItemText>Sin unidad móvil</Select.ItemText>
              <Select.ItemIndicator className="unit-select-check">
                <Check size={17} />
              </Select.ItemIndicator>
            </Select.Item>
            {unidades.map((u) => (
              <Select.Item
                key={u.codigo}
                value={String(u.codigo)}
                textValue={`${u.placa} ${u.descripcion} ${nombreZonal(u.cod_zonal)}`}
                className="unit-select-option"
              >
                <Select.ItemText asChild>
                  <span className="unit-select-text">
                    <span className="unit-select-title">
                      <strong>{u.placa}</strong>
                      <span className="unit-select-zonal">
                        {nombreZonal(u.cod_zonal)}
                      </span>
                    </span>
                    <small>{u.descripcion}</small>
                  </span>
                </Select.ItemText>
                <Select.ItemIndicator className="unit-select-check">
                  <Check size={17} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="unit-select-scroll">
            <ChevronDown size={16} />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
