import { useRef, useState } from "react";
import { CheckCircle2, ListFilter } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Search, matches, useData } from "@/components/common";
import { ValesList } from "@/components/vales-list";
import { api, cents, money } from "@/lib/api";
import { actualizarContexto, invalidarDetalles } from "@/lib/consultas";
import { puedeAutorizarVale } from "@/lib/permisos";
import type { Contexto, Vale } from "@/lib/types";
import { RevisionAutorizacion, type Revision } from "./RevisionAutorizacion";
import "./autorizacion.css";

export default function AutorizarVales({
  onOpen,
  onCloseDetail,
}: {
  onOpen: (vale: Vale, onAuthorize?: (actual: Vale) => void) => void;
  onCloseDetail: () => void;
}) {
  const consulta = useData();
  const { cuenta, vales } = consulta.data!;
  const cache = useQueryClient();
  const [busqueda, setBusqueda] = useState("");
  const [fecha, setFecha] = useState("");
  const [grifo, setGrifo] = useState("");
  const [modalidad, setModalidad] = useState("");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [revision, setRevision] = useState<Revision | null>(null);
  const [resultado, setResultado] = useState("");
  const [error, setError] = useState<unknown>();
  const [ocupado, setOcupado] = useState(false);
  const enviando = useRef(false);

  const pendientes = vales.filter((v) => puedeAutorizarVale(cuenta, v));
  const grifosPendientes = new Set(pendientes.map((v) => v.cod_proveedor));
  const proveedores = cuenta.proveedores.filter(
    (p) => grifosPendientes.has(p.cod_proveedor) || p.cod_proveedor === grifo,
  );
  const visibles = pendientes.filter((v) => {
    const tipo = v.nrocontrato
      ? "CONTRATO"
      : v.codigo_tercero != null
        ? "SC_TERCERO"
        : "SC_TRABAJADOR";
    return (
      matches(v, busqueda) &&
      (!fecha || v.fecha_emision === fecha) &&
      (!grifo || v.cod_proveedor === grifo) &&
      (!modalidad || tipo === modalidad)
    );
  });
  const visibleIds = new Set(visibles.map((v) => v.id_vale));
  const lote = pendientes.filter((v) => seleccion.includes(v.id_vale));
  const fuera = lote.filter((v) => !visibleIds.has(v.id_vale)).length;
  const importe = lote.reduce(
    (total, v) => total + cents(v.importe_estimado),
    0,
  );
  const filtrosActivos = [fecha, grifo, modalidad].filter(Boolean).length;
  const cambios = new Map<string, number | null>();
  if (revision) {
    const actuales = new Map(vales.map((v) => [v.id_vale, v]));
    for (const v of revision.vales) {
      const actual = actuales.get(v.id_vale);
      if (!actual || !puedeAutorizarVale(cuenta, actual)) {
        cambios.set(v.id_vale, actual?.estado_vale ? actual.estado_vale : null);
      }
    }
  }

  function revisar(valesElegidos: Vale[], individual: boolean) {
    setError(undefined);
    setResultado("");
    setRevision({ vales: valesElegidos, individual });
  }

  function quitar(id: string) {
    setSeleccion((previa) => previa.filter((vale) => vale !== id));
    setRevision(
      (previa) =>
        previa && {
          ...previa,
          vales: previa.vales.filter((v) => v.id_vale !== id),
        },
    );
    setError(undefined);
  }

  async function confirmar() {
    if (enviando.current || !revision?.vales.length || cambios.size) return;
    enviando.current = true;
    setOcupado(true);
    setError(undefined);
    const ids = revision.vales.map((v) => v.id_vale);
    try {
      const actualizado = await api<Contexto>("/api/v1/autorizacion/vales", {
        vales: ids,
      });
      await actualizarContexto(cache, actualizado);
      void invalidarDetalles(cache, revision.vales);
      setSeleccion((previa) => previa.filter((id) => !ids.includes(id)));
      setResultado(
        ids.length === 1
          ? "Se autorizó 1 vale."
          : "Se autorizaron " + ids.length + " vales.",
      );
      setRevision(null);
      if (revision.individual) onCloseDetail();
    } catch (e) {
      setError(e);
      await consulta.refetch();
      void invalidarDetalles(cache, revision.vales);
    } finally {
      enviando.current = false;
      setOcupado(false);
    }
  }

  return (
    <section
      className="stack aprobacion-bandeja"
      aria-label="Vales pendientes de autorización"
    >
      <div className="aprobacion-encabezado">
        <h2>Pendientes</h2>
        <span>{pendientes.length}</span>
      </div>
      {resultado && (
        <div className="aprobacion-resultado" role="status">
          <CheckCircle2 aria-hidden="true" />
          {resultado}
        </div>
      )}
      <div className="aprobacion-controles">
        <div className="aprobacion-busqueda">
          <Search
            value={busqueda}
            onChange={setBusqueda}
            placeholder="Código, nombre o placa"
          />
          <Button
            type="button"
            variant="outline"
            className="aprobacion-filtros-boton"
            aria-expanded={filtrosAbiertos}
            aria-controls="filtros-vales-pendientes"
            onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}
          >
            <ListFilter aria-hidden="true" />
            {filtrosActivos ? "Filtros (" + filtrosActivos + ")" : "Filtros"}
          </Button>
        </div>
        <div
          className="aprobacion-filtros"
          id="filtros-vales-pendientes"
          data-abiertos={filtrosAbiertos}
        >
          <Field label="Fecha de emisión">
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </Field>
          <Field label="Grifo">
            <select value={grifo} onChange={(e) => setGrifo(e.target.value)}>
              <option value="">Todos los grifos</option>
              {proveedores.map((p) => (
                <option key={p.cod_proveedor} value={p.cod_proveedor}>
                  {p.razon_social}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Modalidad">
            <select
              value={modalidad}
              onChange={(e) => setModalidad(e.target.value)}
            >
              <option value="">Todas las modalidades</option>
              <option value="CONTRATO">Con contrato</option>
              <option value="SC_TRABAJADOR">
                Sin contrato por vencimiento
              </option>
              <option value="SC_TERCERO">Sin contrato para tercero</option>
            </select>
          </Field>
          {!!filtrosActivos && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setFecha("");
                setGrifo("");
                setModalidad("");
              }}
            >
              Limpiar filtros
            </Button>
          )}
        </div>
      </div>
      <ValesList
        key={[busqueda, fecha, grifo, modalidad].join("|")}
        vista="solicitudes"
        emptyMessage={
          pendientes.length
            ? "No hay pendientes que coincidan con la búsqueda y los filtros."
            : "No hay vales pendientes de autorización."
        }
        vales={visibles}
        onOpen={(vale) =>
          onOpen(vale, (actual) =>
            revisar([{ ...actual, id_vale: vale.id_vale }], true),
          )
        }
        selected={lote.map((v) => v.id_vale)}
        onSelect={(v) => {
          setResultado("");
          setSeleccion((previa) =>
            previa.includes(v.id_vale)
              ? previa.filter((id) => id !== v.id_vale)
              : [...previa, v.id_vale],
          );
        }}
      />
      {!!lote.length && (
        <div className="selection-bar aprobacion-seleccion">
          <div>
            <strong>
              {lote.length === 1
                ? "1 vale seleccionado"
                : lote.length + " vales seleccionados"}
            </strong>
            <small>Total estimado {money(importe / 100)}</small>
          </div>
          <Button type="button" onClick={() => revisar(lote, false)}>
            Revisar selección ({lote.length})
          </Button>
        </div>
      )}
      {revision && (
        <RevisionAutorizacion
          revision={revision}
          cambios={cambios}
          fueraDelFiltro={revision.individual ? 0 : fuera}
          ocupado={ocupado}
          error={error}
          onClose={() => setRevision(null)}
          onRemove={quitar}
          onOpenDetail={onOpen}
          onConfirm={confirmar}
        />
      )}
    </section>
  );
}
