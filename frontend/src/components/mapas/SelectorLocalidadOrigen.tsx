import { Field } from "@/components/common";
import type { Cuenta } from "@/lib/types";

export function SelectorLocalidadOrigen({
  cuenta,
  label,
  localidad,
  onChange,
}: {
  cuenta: Pick<Cuenta, "localidades" | "zonales">;
  label: string;
  localidad: string;
  onChange: (codigo: string) => void;
}) {
  return (
    <Field label={label}>
      <select value={localidad} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>
          Ubicación personalizada
        </option>
        {cuenta.zonales.map((z) => (
          <optgroup key={z.id_zona} label={z.nom_zona}>
            {cuenta.localidades
              .filter((l) => l.id_zona === z.id_zona)
              .map((l) => (
                <option value={l.id_localidad} key={l.id_localidad}>
                  {l.nom_localidad}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </Field>
  );
}
