import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Busy, ErrorText, Field, useRefresh } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, date, money, today } from "@/lib/api";
import type { Contrato, Cuenta } from "@/lib/types";
import { campo, type Tarifa } from "./administracion-datos";
import {
  AvisoAdministracion,
  DialogoAdministracion,
  TablaAdministracion,
} from "./administracion-ui";

type ContratoVigente = Pick<
  Contrato,
  "id" | "proveedor" | "inicio" | "fin" | "precios"
>;
type Suministros = Cuenta["suministros"];

function suministrosPendientes(
  contrato: ContratoVigente,
  suministros: Suministros,
) {
  return suministros.filter(
    ({ id_suministro }) => !Object.hasOwn(contrato.precios, id_suministro),
  );
}

export default function Precios({
  tarifas,
  cuenta,
}: {
  tarifas: Tarifa[];
  cuenta: Cuenta;
}) {
  const refrescar = useRefresh();
  const [dialogo, abrir] = useState<"tarifa" | "contrato">();
  const [mensaje, avisar] = useState("");
  const contratos = useQuery({
    queryKey: ["contratos-admin"],
    queryFn: () =>
      api<ContratoVigente[]>("/api/administracion/contratos-vigentes"),
  });
  const completables = (contratos.data ?? []).filter(
    (contrato) =>
      suministrosPendientes(contrato, cuenta.suministros).length > 0,
  );
  const nombreGrifo = (codigo: string) =>
    cuenta.proveedores.find((p) => p.cod_proveedor === codigo)?.razon_social ??
    codigo;
  const nombreSuministro = (codigo: string) =>
    cuenta.suministros.find((s) => s.id_suministro === codigo)?.descripcion ??
    codigo;
  const cerrar = () => abrir(undefined);

  async function guardar(url: string, datos: unknown, texto: string) {
    await api("/api/administracion/" + url, datos);
    await refrescar(
      [url === "tarifas" ? "administracion" : "contratos-admin"],
      ["contexto"],
      ["precio-atencion"],
      ["recomendacion-ruta"],
    );
    avisar(texto);
  }

  return (
    <div className="admin-precios">
      <AvisoAdministracion mensaje={mensaje} />
      <section className="admin-seccion" aria-labelledby="admin-tarifas-titulo">
        <div className="admin-cabecera">
          <h2 id="admin-tarifas-titulo">Tarifas de grifos</h2>
          <Button onClick={() => abrir("tarifa")}>
            <Plus /> Nueva tarifa
          </Button>
        </div>
        <TablaAdministracion
          titulo="Tarifas de grifos"
          filas={tarifas}
          clave={(t) =>
            [t.cod_proveedor, t.id_suministro, t.vigente_desde].join("/")
          }
          vacio="Todavía no hay tarifas registradas."
          columnas={[
            {
              titulo: "Grifo",
              mostrar: (t) => <strong>{nombreGrifo(t.cod_proveedor)}</strong>,
            },
            {
              titulo: "Combustible",
              mostrar: (t) => nombreSuministro(t.id_suministro),
            },
            { titulo: "Vigente desde", mostrar: (t) => date(t.vigente_desde) },
            {
              titulo: "Precio por galón",
              mostrar: (t) => <strong>{money(t.precio)}</strong>,
              numerica: true,
            },
          ]}
        />
      </section>

      <section
        className="admin-seccion"
        aria-labelledby="admin-contratos-titulo"
      >
        <div className="admin-cabecera">
          <h2 id="admin-contratos-titulo">Precios pactados</h2>
          <Button
            onClick={() => abrir("contrato")}
            disabled={!completables.length}
          >
            <Plus /> Completar precio
          </Button>
        </div>
        <ErrorText error={contratos.error} />
        {contratos.isPending && <Busy />}
        {contratos.data && (
          <TablaAdministracion
            titulo="Contratos vigentes"
            filas={contratos.data}
            clave={(c) => c.id}
            vacio="No hay contratos vigentes."
            columnas={[
              {
                titulo: "Contrato",
                mostrar: (c) => (
                  <>
                    <strong>{c.id}</strong>
                    <small>{nombreGrifo(c.proveedor)}</small>
                  </>
                ),
              },
              {
                titulo: "Vigencia",
                mostrar: (c) => (
                  <span>
                    {date(c.inicio)}
                    <small>Hasta {date(c.fin)}</small>
                  </span>
                ),
              },
              {
                titulo: "Precios por galón",
                mostrar: (c) =>
                  Object.keys(c.precios).length ? (
                    <ul className="admin-precios-pactados">
                      {Object.entries(c.precios).map(([id, precio]) => (
                        <li key={id}>
                          <span>{nombreSuministro(id)}</span>
                          <strong>{money(precio)}</strong>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "Sin precios registrados"
                  ),
              },
            ]}
          />
        )}
      </section>

      {dialogo === "tarifa" && (
        <DialogoAdministracion
          titulo="Tarifa vigente del grifo"
          etiqueta="Guardar tarifa"
          cerrar={cerrar}
          guardar={(f) =>
            guardar(
              "tarifas",
              {
                grifo: campo(f, "grifo"),
                suministro: campo(f, "suministro"),
                desde: campo(f, "desde"),
                precio: Number(campo(f, "precio")),
              },
              "Tarifa registrada.",
            )
          }
        >
          <div className="admin-campos">
            <Field label="Grifo">
              <select name="grifo" defaultValue="" required>
                <option value="">Seleccionar grifo</option>
                {cuenta.proveedores.map((p) => (
                  <option key={p.cod_proveedor} value={p.cod_proveedor}>
                    {p.razon_social}
                  </option>
                ))}
              </select>
            </Field>
            <SeleccionSuministro suministros={cuenta.suministros} />
            <div className="admin-campos-pareados">
              <Field label="Vigente desde">
                <Input
                  type="date"
                  name="desde"
                  defaultValue={today()}
                  required
                />
              </Field>
              <PrecioPorGalon />
            </div>
          </div>
        </DialogoAdministracion>
      )}
      {dialogo === "contrato" && (
        <PrecioPactado
          contratos={completables}
          suministros={cuenta.suministros}
          nombreGrifo={nombreGrifo}
          guardar={(datos) =>
            guardar("precios-contrato", datos, "Precio pactado registrado.")
          }
          cerrar={cerrar}
        />
      )}
    </div>
  );
}

function PrecioPactado({
  contratos,
  suministros,
  nombreGrifo,
  guardar,
  cerrar,
}: {
  contratos: ContratoVigente[];
  suministros: Suministros;
  nombreGrifo: (codigo: string) => string;
  guardar: (datos: unknown) => Promise<void>;
  cerrar: () => void;
}) {
  const [id, elegir] = useState("");
  const contrato = contratos.find((c) => c.id === id);

  return (
    <DialogoAdministracion
      titulo="Completar el precio pactado de un contrato"
      etiqueta="Guardar precio pactado"
      cerrar={cerrar}
      bloqueado={!contrato}
      guardar={async (f) => {
        if (!contrato) throw new Error("Selecciona un contrato vigente.");
        await guardar({
          proveedor: contrato.proveedor,
          contrato: contrato.id,
          suministro: campo(f, "suministro"),
          precio: Number(campo(f, "precio")),
        });
      }}
    >
      <div className="admin-campos">
        <Field label="Contrato vigente">
          <select
            name="contrato"
            value={id}
            onChange={(e) => elegir(e.target.value)}
            required
          >
            <option value="">Seleccionar contrato</option>
            {contratos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} — {nombreGrifo(c.proveedor)}
              </option>
            ))}
          </select>
        </Field>
        <SeleccionSuministro
          key={id}
          label="Combustible sin precio pactado"
          suministros={
            contrato ? suministrosPendientes(contrato, suministros) : []
          }
          disabled={!contrato}
        />
        <PrecioPorGalon />
      </div>
    </DialogoAdministracion>
  );
}

function SeleccionSuministro({
  suministros,
  label = "Combustible",
  disabled,
}: {
  suministros: Suministros;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <Field label={label}>
      <select name="suministro" defaultValue="" required disabled={disabled}>
        <option value="">Seleccionar combustible</option>
        {suministros.map((s) => (
          <option key={s.id_suministro} value={s.id_suministro}>
            {s.descripcion}
          </option>
        ))}
      </select>
    </Field>
  );
}

function PrecioPorGalon() {
  return (
    <Field label="Precio por galón (S/)">
      <Input
        name="precio"
        type="number"
        inputMode="decimal"
        min="0.01"
        step="0.01"
        placeholder="0.00"
        required
      />
    </Field>
  );
}
