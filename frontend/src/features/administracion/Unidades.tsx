import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { Busy, ErrorText } from "@/components/ui/feedback";
import { Field } from "@/components/formularios/campos";
import { useRefresh } from "@/lib/consultas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { Cuenta, Unidad } from "@/lib/types";
import { campo } from "./administracion-datos";
import {
  AvisoAdministracion,
  DialogoAdministracion,
  TablaAdministracion,
} from "./administracion-ui";

type UnidadBase = Pick<Unidad, "codigo" | "placa" | "descripcion"> & {
  cod_zonal: string | null;
};
type Zonales = Cuenta["zonales"];

export default function Unidades({ zonales }: { zonales: Zonales }) {
  const refrescar = useRefresh();
  const consulta = useQuery({
    queryKey: ["unidades-admin"],
    queryFn: () =>
      api<{ unidades: UnidadBase[] }>("/api/administracion/unidades"),
  });
  const [edicion, editar] = useState<number | null>();
  const [mensaje, avisar] = useState("");
  const unidades = consulta.data?.unidades ?? [];
  const fijada = unidades.find(({ codigo }) => codigo === edicion);

  return (
    <section className="admin-seccion" aria-labelledby="admin-unidades-titulo">
      <div className="admin-cabecera">
        <h2 id="admin-unidades-titulo">Zonal base de las unidades móviles</h2>
        <Button onClick={() => editar(null)} disabled={!unidades.length}>
          <Plus /> Asignar zonal base
        </Button>
      </div>
      <AvisoAdministracion mensaje={mensaje} />
      <ErrorText error={consulta.error} />
      {consulta.isPending && <Busy />}
      {consulta.data && (
        <TablaAdministracion
          titulo="Unidades móviles"
          filas={unidades}
          clave={(u) => u.codigo}
          vacio="Todavía no hay unidades móviles."
          columnas={[
            { titulo: "Placa", mostrar: (u) => <strong>{u.placa}</strong> },
            { titulo: "Unidad móvil", mostrar: (u) => u.descripcion },
            {
              titulo: "Zonal base",
              mostrar: (u) => (
                <Badge
                  variant="outline"
                  className="admin-estado"
                  data-activa={!!u.cod_zonal}
                >
                  {zonales.find((z) => z.id_zona === u.cod_zonal)?.nom_zona ??
                    u.cod_zonal ??
                    "Sin asignar"}
                </Badge>
              ),
            },
          ]}
          acciones={(u) => {
            const etiqueta = "Editar zonal base de " + u.placa;
            return (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={etiqueta}
                title={etiqueta}
                onClick={() => editar(u.codigo)}
              >
                <Pencil />
              </Button>
            );
          }}
        />
      )}
      {(edicion === null || fijada) && (
        <ZonalBase
          unidades={unidades}
          zonales={zonales}
          fija={fijada}
          cerrar={() => editar(undefined)}
          guardar={async (codigo, zonal) => {
            const destino = encodeURIComponent(zonal);
            await api(
              "/api/administracion/unidades/" + codigo + "/zonal/" + destino,
              {},
            );
            await refrescar(["unidades-admin"], ["contexto"], ["prestamos"]);
            avisar("Zonal base actualizada.");
          }}
        />
      )}
    </section>
  );
}

function ZonalBase({
  unidades,
  zonales,
  fija,
  guardar,
  cerrar,
}: {
  unidades: UnidadBase[];
  zonales: Zonales;
  fija?: UnidadBase;
  guardar: (codigo: number, zonal: string) => Promise<void>;
  cerrar: () => void;
}) {
  const [codigo, elegir] = useState(fija ? String(fija.codigo) : "");
  const unidad = unidades.find((u) => String(u.codigo) === codigo);

  return (
    <DialogoAdministracion
      titulo={fija ? "Editar zonal base" : "Asignar zonal base"}
      etiqueta="Guardar zonal base"
      cerrar={cerrar}
      bloqueado={!unidad}
      guardar={async (f) => {
        if (!unidad) throw new Error("Selecciona una unidad móvil.");
        await guardar(unidad.codigo, campo(f, "zonal"));
      }}
    >
      <div className="admin-campos">
        <Field label="Unidad móvil">
          {fija ? (
            <Input value={fija.placa + " — " + fija.descripcion} disabled />
          ) : (
            <select
              name="unidad"
              value={codigo}
              onChange={(e) => elegir(e.target.value)}
              required
            >
              <option value="">Seleccionar unidad</option>
              {unidades.map((u) => (
                <option key={u.codigo} value={u.codigo}>
                  {u.placa} — {u.descripcion}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Zonal base">
          <select
            key={codigo}
            name="zonal"
            defaultValue={unidad?.cod_zonal ?? ""}
            required
            disabled={!unidad}
          >
            <option value="">Seleccionar zonal</option>
            {zonales.map((z) => (
              <option key={z.id_zona} value={z.id_zona}>
                {z.nom_zona}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </DialogoAdministracion>
  );
}
