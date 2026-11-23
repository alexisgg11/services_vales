import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InfoPopover } from "@/components/ui/info-popover";
import { ErrorText } from "@/components/ui/feedback";
import { Field } from "@/components/formularios/campos";
import { useData, useRefresh } from "@/lib/consultas";
import { useModal } from "@/components/dialogos/confirmacion";
import type { Unidad, Centro } from "@/lib/types";
import { api, today } from "@/lib/api";

interface PrestamosDatos {
  unidades: Unidad[];
  centros: Centro[];
}
export default function PrestamosUnidades() {
  const { data } = useData(),
    modal = useModal(),
    refresh = useRefresh(),
    c = data!.cuenta;
  const info = useQuery({
    queryKey: ["prestamos", c.actor],
    queryFn: () => api<PrestamosDatos>("/api/v1/autorizacion/unidades"),
  });
  const [unit, setUnit] = useState(""),
    [zone, setZone] = useState(""),
    [center, setCenter] = useState(""),
    [desde, setDesde] = useState(today()),
    [hasta, setHasta] = useState(today());
  return (
    <section className="panel">
      <div className="row spaced">
        <h2>Préstamos de unidades</h2>
        <InfoPopover title="Préstamos de unidades">
          <p>
            Jefatura habilita vehículos de su zonal para un centro de costo y un
            período en otra zonal.
          </p>
        </InfoPopover>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          modal({
            title: "Habilitar el préstamo",
            body: (
              <p>Se habilitará la unidad para el trabajo y fechas indicados.</p>
            ),
            action: async () => {
              await api(
                "/api/administracion/unidades/" + unit + "/habilitaciones",
                { zonal: zone, centro: center, desde, hasta },
              );
              await refresh(["contexto"], ["prestamos", c.actor]);
            },
          });
        }}
      >
        <div className="form-grid">
          <Field label="Unidad móvil">
            <select
              aria-label="Unidad móvil del préstamo"
              required
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            >
              <option value="">Seleccionar</option>
              {info.data?.unidades.map((u) => (
                <option key={u.codigo} value={u.codigo}>
                  {u.placa} — {u.descripcion}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Zonal de destino">
            <select
              aria-label="Zonal de destino"
              required
              value={zone}
              onChange={(e) => setZone(e.target.value)}
            >
              <option value="">Seleccionar</option>
              {c.zonales
                .filter(
                  (z) =>
                    z.id_zona !==
                    info.data?.unidades.find((u) => String(u.codigo) === unit)
                      ?.cod_zonal,
                )
                .map((z) => (
                  <option key={z.id_zona} value={z.id_zona}>
                    {z.nom_zona}
                  </option>
                ))}
            </select>
          </Field>
          <div className="prestamos-centro">
            <Field label="Centro de costo del trabajo">
              <select
                required
                aria-label="Centro del préstamo"
                value={center}
                onChange={(e) => setCenter(e.target.value)}
              >
                <option value="">Seleccionar</option>
                {info.data?.centros.map((x) => (
                  <option key={x.cod_centro_costo} value={x.cod_centro_costo}>
                    {x.descripcion}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="prestamos-fechas">
            <Field label="Desde">
              <Input
                aria-label="Préstamo desde"
                type="date"
                required
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </Field>
            <Field label="Hasta">
              <Input
                aria-label="Préstamo hasta"
                type="date"
                min={desde}
                required
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
            </Field>
          </div>
        </div>
        <ErrorText error={info.error} />
        <div className="actions">
          <Button disabled={!info.data}>Habilitar unidad</Button>
        </div>
      </form>
    </section>
  );
}
