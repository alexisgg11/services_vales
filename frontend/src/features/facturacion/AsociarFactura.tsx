import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  CircleCheck,
  Link,
  ListChecks,
  Tickets,
  X,
} from "lucide-react";
import { Search, matches, useData, useModal } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ValesList } from "@/components/vales-list";
import { api, money } from "@/lib/api";
import { actualizarContexto, invalidarDetalles } from "@/lib/consultas";
import type { Contexto, Vale } from "@/lib/types";
import { CompararFactura, DiagnosticoFactura } from "./CompararFactura";
import {
  ConfirmarAsociacion,
  type AsociacionPendiente,
} from "./ConfirmarAsociacion";
import {
  cambiosDeSeleccion,
  conciliar,
  optimizarAsociacion,
  valePendienteDeAsociar,
} from "./conciliar";
import "./asociar-factura.css";

export function AsociarFactura({ onOpen }: { onOpen: (vale: Vale) => void }) {
  const consulta = useData();
  const cliente = useQueryClient();
  const modal = useModal();
  const { cuenta, vales } = consulta.data!;
  const [busqueda, setBusqueda] = useState("");
  const [filtroGrifo, setFiltroGrifo] = useState("");
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [seleccionMovilActiva, setSeleccionMovilActiva] = useState(false);
  const [facturaId, setFacturaId] = useState("");
  const [avisoOptimizacion, setAvisoOptimizacion] = useState("");
  const [revisando, setRevisando] = useState(false);
  const [confirmacion, setConfirmacion] = useState<AsociacionPendiente>();
  const [resultadoGuardado, setResultadoGuardado] = useState("");
  const [error, setError] = useState<unknown>();
  const [ocupado, setOcupado] = useState(false);
  const enviando = useRef(false);
  const ignorarClicDePulsacion = useRef(false);

  const pendientes = vales.filter(valePendienteDeAsociar);
  const idsSeleccionados = new Set(seleccion);
  const lote = pendientes.filter((vale) => idsSeleccionados.has(vale.id_vale));
  const seleccionando = seleccionMovilActiva || lote.length > 0;
  const grifo = lote[0]?.cod_proveedor;
  const nombreGrifo =
    cuenta.proveedores.find((p) => p.cod_proveedor === grifo)?.razon_social ??
    lote[0]?.grifo ??
    "";
  const grifosPendientes = new Set(
    pendientes.map((vale) => vale.cod_proveedor),
  );
  const facturas = (cuenta.facturas ?? []).filter(
    (factura) =>
      factura.cod_proveedor === grifo && factura.asociado_por == null,
  );
  const factura = facturas.find((f) => f.codigo_factura === facturaId);
  const resultado = conciliar(factura, lote);
  const cambios = factura && cambiosDeSeleccion(factura, resultado, pendientes);
  const vigente =
    !!confirmacion &&
    confirmacion.factura.codigo_factura === factura?.codigo_factura &&
    resultado.listo &&
    confirmacion.total === resultado.suma &&
    lote.length === confirmacion.vales.length &&
    confirmacion.vales.every((vale) =>
      lote.some((v) => v.id_vale === vale.id_vale),
    );

  function vaciarSeleccion() {
    setSeleccion([]);
    setSeleccionMovilActiva(false);
    setFacturaId("");
    setAvisoOptimizacion("");
    setRevisando(false);
  }

  function cambiarFiltro(nuevo: string) {
    if (grifo && nuevo && nuevo !== grifo) {
      modal({
        title: "Cambiar grifo",
        body: <p>Al cambiar de grifo se vaciará la selección actual.</p>,
        label: "Cambiar grifo",
        action: async () => {
          vaciarSeleccion();
          setFiltroGrifo(nuevo);
        },
      });
      return;
    }
    setFiltroGrifo(nuevo);
  }

  function quitarVale(vale: Vale) {
    setAvisoOptimizacion("");
    const restantes = lote.filter((v) => v.id_vale !== vale.id_vale);
    if (!restantes.length) vaciarSeleccion();
    else setSeleccion(restantes.map((v) => v.id_vale));
  }

  function marcarVale(vale: Vale) {
    setResultadoGuardado("");
    if (idsSeleccionados.has(vale.id_vale)) {
      quitarVale(vale);
      return;
    }
    if (grifo && vale.cod_proveedor !== grifo) {
      modal({
        title: "Selecciona vales del mismo grifo",
        body: (
          <p>
            Quita la selección de {nombreGrifo} para elegir vales de otro grifo.
          </p>
        ),
      });
      return;
    }
    if (!grifo) {
      setFiltroGrifo(vale.cod_proveedor);
      setFacturaId("");
    }
    setAvisoOptimizacion("");
    setSeleccion([...lote.map((v) => v.id_vale), vale.id_vale]);
  }

  function elegirFactura(id: string) {
    setAvisoOptimizacion("");
    setFacturaId(id);
  }

  function mantenerVale(vale: Vale) {
    ignorarClicDePulsacion.current = true;
    marcarVale(vale);
  }

  function optimizar() {
    const optimizacion = optimizarAsociacion(
      facturas,
      lote,
      pendientes,
      facturaId,
    );
    if (optimizacion.estado === "encontrada") {
      setSeleccion(optimizacion.vales.map((vale) => vale.id_vale));
      elegirFactura(optimizacion.factura.codigo_factura);
    } else {
      setAvisoOptimizacion(
        optimizacion.estado === "varias-coincidencias"
          ? "Hay varias facturas posibles. Elige una y vuelve a usar la varita."
          : "No hay una factura que cuadre con los tickets y el importe.",
      );
    }
  }

  function revisarConfirmacion() {
    if (!factura || !resultado.listo) return;
    setError(undefined);
    setConfirmacion({
      factura,
      grifo: nombreGrifo,
      vales: lote,
      total: resultado.suma,
    });
  }

  async function asociar() {
    if (!confirmacion || !vigente || enviando.current) return;
    enviando.current = true;
    setOcupado(true);
    setError(undefined);
    const { factura, vales } = confirmacion;
    try {
      const actualizado = await api<Contexto>(
        "/api/v1/facturacion/facturas/" + factura.codigo_factura + "/vales",
        { vales: vales.map((vale) => vale.id_vale) },
      );
      await actualizarContexto(cliente, actualizado);
      void invalidarDetalles(cliente, vales);
      setResultadoGuardado(
        `Factura ${factura.serie}-${factura.numero} asociada.`,
      );
      setConfirmacion(undefined);
      vaciarSeleccion();
    } catch (error) {
      setError(error);
      await consulta.refetch();
    } finally {
      enviando.current = false;
      setOcupado(false);
    }
  }

  const comparacion = {
    vales: lote,
    grifo: nombreGrifo,
    factura,
    facturas,
    resultado,
    avisoOptimizacion,
    onElegir: elegirFactura,
    onOptimizar: optimizar,
    onOpen,
    onQuitar: quitarVale,
  };
  const botonAsociar = (
    <Button
      type="button"
      disabled={!resultado.listo}
      onClick={revisarConfirmacion}
    >
      <Link aria-hidden="true" /> Asociar factura
    </Button>
  );
  const estadoFactura = factura && cambios && (
    <DiagnosticoFactura
      factura={factura}
      resultado={resultado}
      cambios={cambios}
    />
  );

  return (
    <div className="asociar-factura" data-seleccion={seleccionando}>
      {resultadoGuardado && (
        <p className="factura-asociada" role="status">
          <CircleCheck size={18} aria-hidden="true" /> {resultadoGuardado}
        </p>
      )}
      <section className="asociar-vales" aria-labelledby="asociar-vales-titulo">
        <div className="asociar-vales-cabecera">
          <h2 id="asociar-vales-titulo">
            <Tickets aria-hidden="true" /> Vales atendidos
          </h2>
          {!!pendientes.length && !seleccionando && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="factura-activar-seleccion"
              aria-label="Seleccionar vales"
              title="Seleccionar vales"
              onClick={() => setSeleccionMovilActiva(true)}
            >
              <ListChecks aria-hidden="true" />
            </Button>
          )}
        </div>
        <div
          className="list-surface asociar-vales-lista"
          onPointerDownCapture={(evento) => {
            if (evento.isPrimary && evento.button === 0) {
              ignorarClicDePulsacion.current = false;
            }
          }}
          onClickCapture={(evento) => {
            // El cambio de grifo puede volver a montar la lista antes de soltar.
            if (ignorarClicDePulsacion.current && evento.detail > 0) {
              ignorarClicDePulsacion.current = false;
              evento.preventDefault();
              evento.stopPropagation();
            }
          }}
        >
          <div className="asociar-vales-filtros">
            <Search value={busqueda} onChange={setBusqueda} />
            <select
              aria-label="Filtrar grifo"
              value={filtroGrifo}
              onChange={(e) => cambiarFiltro(e.target.value)}
            >
              <option value="">Todos los grifos</option>
              {cuenta.proveedores
                .filter(
                  (p) =>
                    grifosPendientes.has(p.cod_proveedor) ||
                    p.cod_proveedor === filtroGrifo,
                )
                .map((p) => (
                  <option key={p.cod_proveedor} value={p.cod_proveedor}>
                    {p.razon_social}
                  </option>
                ))}
            </select>
          </div>
          <ValesList
            key={filtroGrifo + ":" + busqueda}
            vista="facturacion"
            vales={pendientes.filter(
              (vale) =>
                (!filtroGrifo || vale.cod_proveedor === filtroGrifo) &&
                matches(vale, busqueda),
            )}
            selected={seleccion}
            onSelect={marcarVale}
            seleccionMovil={{ activa: seleccionando, mantener: mantenerVale }}
            onOpen={onOpen}
            emptyMessage={
              pendientes.length
                ? "No hay vales que coincidan con los filtros."
                : "No hay vales atendidos pendientes de asociar."
            }
          />
        </div>
      </section>

      <section
        className="factura-comparador-escritorio"
        aria-labelledby="factura-comparador-titulo"
      >
        <h2 id="factura-comparador-titulo">
          <ArrowLeftRight aria-hidden="true" /> Comparar y asociar
        </h2>
        <CompararFactura {...comparacion} />
        <div className="factura-comparador-acciones">
          {estadoFactura}
          {botonAsociar}
        </div>
      </section>

      <Sheet open={revisando} onOpenChange={setRevisando}>
        {seleccionando && (
          <div className="factura-barra-movil">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="factura-cancelar-seleccion"
              aria-label="Cancelar selección"
              title="Cancelar selección"
              onClick={vaciarSeleccion}
            >
              <X aria-hidden="true" />
            </Button>
            <div className="factura-resumen-movil" aria-live="polite">
              <small>
                {lote.length
                  ? lote.length + (lote.length === 1 ? " vale" : " vales")
                  : "Selecciona vales"}
              </small>
              {!!lote.length && <strong>{money(resultado.suma)}</strong>}
            </div>
            <SheetTrigger asChild>
              <Button type="button" disabled={!lote.length}>
                Revisar asociación
              </Button>
            </SheetTrigger>
          </div>
        )}
        <SheetContent
          side="right"
          className="factura-revision"
          closeLabel="Cerrar revisión"
        >
          <SheetHeader className="factura-dialogo-cabecera">
            <SheetTitle>Revisar asociación</SheetTitle>
            <SheetDescription className="sr-only">
              Compara los tickets y el total con la factura del grifo.
            </SheetDescription>
          </SheetHeader>
          <div className="factura-dialogo-cuerpo">
            <CompararFactura {...comparacion} />
          </div>
          <SheetFooter className="factura-dialogo-pie">
            {estadoFactura}
            <div className="factura-dialogo-acciones">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRevisando(false)}
              >
                Volver
              </Button>
              {botonAsociar}
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {confirmacion && (
        <ConfirmarAsociacion
          asociacion={confirmacion}
          vigente={vigente}
          ocupado={ocupado}
          error={error}
          onOpenVale={onOpen}
          onCancelar={() => setConfirmacion(undefined)}
          onConfirmar={asociar}
        />
      )}
    </div>
  );
}
