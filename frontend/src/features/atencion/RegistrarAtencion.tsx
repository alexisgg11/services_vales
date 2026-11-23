import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Copy, Fuel, ScanQrCode, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorText } from "@/components/ui/feedback";
import { Field } from "@/components/formularios/campos";
import { ValeCard } from "@/components/vales/TarjetaVale";
import {
  useData,
  useRefresh,
  contextoConsulta,
  detalleValeConsulta,
  invalidarDetalles,
} from "@/lib/consultas";
import { ValesList } from "@/components/vales/lista-vales";
import { api, ApiError, date, money, qty } from "@/lib/api";

import type { Contexto, Vale } from "@/lib/types";
import {
  coincideBusqueda,
  correspondeAlGrifo,
  mensajeEstado,
  referenciaQr,
} from "./busqueda-atencion";
import { FormularioDespacho } from "./FormularioDespacho";
import { Scanner } from "./scanner";
import { SeleccionAtencion } from "./SeleccionAtencion";
import "./atencion.css";

export default function RegistrarAtencion({
  onOpen,
}: {
  onOpen: (vale: Vale) => void;
}) {
  const consulta = useData();
  const cache = useQueryClient();
  const refresh = useRefresh();
  const { cuenta, vales } = consulta.data!;
  const [busqueda, setBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [lector, setLector] = useState(false);
  const [error, setError] = useState<unknown>();
  const [seleccion, setSeleccion] = useState<Vale>();
  const [vale, setVale] = useState<Vale>();
  const [recibo, setRecibo] = useState<Vale>();
  const [copia, setCopia] = useState("");
  const entradaBusqueda = useRef<HTMLInputElement>(null);
  const tituloRecibo = useRef<HTMLHeadingElement>(null);
  const lista = vales.filter(
    (v) =>
      v.estado_vale === 1 &&
      correspondeAlGrifo(v, cuenta.roles) &&
      coincideBusqueda(v, busqueda),
  );

  const consultarVale = useCallback(
    async (id: string, signal?: AbortSignal) => {
      let actual: Vale;
      try {
        actual = (
          await api<{ vale: Vale }>(
            "/api/v1/documentos/" + id,
            undefined,
            signal,
          )
        ).vale;
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          throw new Error(
            "El vale no está disponible para este grifo y zonal.",
          );
        }
        throw e;
      }
      if (signal?.aborted) return;
      if (!correspondeAlGrifo(actual, cuenta.roles))
        throw new Error("El vale corresponde a otro grifo o zonal.");
      if (actual.estado_vale === 3 && actual.ticket) {
        setVale(undefined);
        setCopia("");
        setRecibo(actual);
      } else if (actual.estado_vale === 1 && actual.puede_atender !== false) {
        setRecibo(undefined);
        setVale(actual);
      } else {
        throw new Error(mensajeEstado(actual));
      }
      setSeleccion(undefined);
      setError(undefined);
      setLector(false);
    },
    [cuenta.roles],
  );

  useEffect(() => {
    let solicitud: AbortController | undefined;

    async function abrirEnlace() {
      const hash = location.hash;
      const [ruta, parametros] = hash.split("?");
      if (ruta !== "#/atencion") return;
      const id = new URLSearchParams(parametros).get("vale");
      if (id == null) return;
      solicitud?.abort();
      const control = new AbortController();
      solicitud = control;
      try {
        const referencia = referenciaQr(id);
        if (!referencia) throw new Error("El enlace del vale no es válido.");
        await consultarVale(referencia, control.signal);
      } catch (e) {
        if (!control.signal.aborted) setError(e);
      } finally {
        if (!control.signal.aborted && location.hash === hash) {
          history.replaceState(
            null,
            "",
            location.pathname + location.search + "#/atencion",
          );
        }
      }
    }

    window.addEventListener("hashchange", abrirEnlace);
    void abrirEnlace();
    return () => {
      window.removeEventListener("hashchange", abrirEnlace);
      solicitud?.abort();
    };
  }, [consultarVale]);

  useEffect(() => {
    if (recibo) tituloRecibo.current?.focus({ preventScroll: true });
  }, [recibo]);

  function enfocarBusqueda() {
    requestAnimationFrame(() =>
      entradaBusqueda.current?.focus({ preventScroll: true }),
    );
  }

  function volver() {
    setRecibo(undefined);
    setBusqueda("");
    setError(undefined);
    setCopia("");
    enfocarBusqueda();
  }

  async function abrirFila(v: Vale) {
    if (buscando) return;
    setBuscando(true);
    setError(undefined);
    try {
      await consultarVale(v.id_qr);
    } catch (e) {
      setError(e);
    } finally {
      setBuscando(false);
    }
  }

  async function buscar() {
    const valor = busqueda.trim();
    if (!valor || buscando) return;
    const qr = referenciaQr(valor);
    setError(undefined);
    setBuscando(true);
    try {
      if (qr) {
        await consultarVale(qr);
        return;
      }
      const filtrar = ({ vales, cuenta }: Contexto) => {
        const delGrifo = vales.filter((v) =>
          correspondeAlGrifo(v, cuenta.roles),
        );
        const exactos = delGrifo.filter(
          (v) =>
            v.codigo_vale === valor ||
            v.ticket?.toLowerCase() === valor.toLowerCase(),
        );
        return {
          exactos,
          resultados: exactos.length
            ? exactos
            : delGrifo.filter(
                (v) => v.estado_vale === 1 && coincideBusqueda(v, valor),
              ),
        };
      };
      const previa = cache.getQueryState(
        contextoConsulta.queryKey,
      )?.dataUpdatedAt;
      let { resultados, exactos } = filtrar(
        await cache.fetchQuery(contextoConsulta),
      );
      if (
        !resultados.length &&
        previa === cache.getQueryState(contextoConsulta.queryKey)?.dataUpdatedAt
      ) {
        ({ resultados, exactos } = filtrar(
          await cache.fetchQuery({ ...contextoConsulta, staleTime: 0 }),
        ));
      }
      if (resultados.length === 1) await consultarVale(resultados[0].id_qr);
      else if (!resultados.length)
        throw new Error("No encontramos un vale para esa búsqueda.");
      else if (exactos.length && exactos.every((v) => v.estado_vale !== 1)) {
        throw new Error(
          "Ese código corresponde a varios vales. Usa el QR del vale o su número de ticket.",
        );
      }
    } catch (e) {
      setError(e);
    } finally {
      setBuscando(false);
    }
  }

  if (recibo) {
    const v = recibo;
    return (
      <section className="atencion-recibo stack" aria-label="Vale atendido">
        <h2 className="atencion-exito" ref={tituloRecibo} tabIndex={-1}>
          <CheckCircle2 aria-hidden="true" />
          Vale atendido
        </h2>
        <ValeCard
          vale={v}
          onOpen={onOpen}
          datos={[
            [
              v.codigo_tercero != null ? "Tercero" : "Trabajador",
              v.tercero ?? v.trabajador,
            ],
            ["Grifo", v.grifo],
            ["Combustible", v.suministro],
            ["Fecha de consumo", date(v.fecha_consumo)],
            ["Galones despachados", qty(v.cantidad_consumida) + " gal"],
            ["Precio real por galón", money(v.precio_real)],
          ]}
        >
          <dl className="atencion-ticket">
            <div>
              <dt>Ticket de atención</dt>
              <dd className="atencion-ticket-numero">{v.ticket}</dd>
            </div>
            <div className="atencion-total">
              <dt>Importe real</dt>
              <dd>{money(v.importe)}</dd>
            </div>
          </dl>
          {copia && (
            <p className="atencion-copia muted" role="status">
              {copia}
            </p>
          )}
        </ValeCard>
        <div className="actions atencion-recibo-acciones">
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Copiar ticket"
            aria-label="Copiar ticket"
            disabled={!v.ticket}
            onClick={async () => {
              if (!v.ticket) return;
              try {
                await navigator.clipboard.writeText(v.ticket);
                setCopia("Ticket copiado.");
              } catch {
                setCopia("Selecciona el número del ticket para copiarlo.");
              }
            }}
          >
            <Copy aria-hidden="true" />
          </Button>
          <Button type="button" onClick={volver}>
            Atender siguiente vale
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div className="stack">
      <form
        className="atencion-buscar"
        onSubmit={(e) => {
          e.preventDefault();
          void buscar();
        }}
      >
        <Field label="Buscar vale">
          <Input
            ref={entradaBusqueda}
            type="search"
            value={busqueda}
            placeholder="Código, nombre, placa o ticket"
            autoComplete="off"
            onChange={(e) => {
              setBusqueda(e.target.value);
              setError(undefined);
            }}
          />
        </Field>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="atencion-qr"
          aria-label="Escanear QR"
          title="Escanear QR"
          disabled={buscando}
          onClick={() => {
            setError(undefined);
            setLector(true);
          }}
        >
          <ScanQrCode className="size-5" aria-hidden="true" />
        </Button>
        <Button type="submit" disabled={!busqueda.trim() || buscando}>
          <Search aria-hidden="true" /> Buscar
        </Button>
      </form>
      {!seleccion && <ErrorText error={error} />}
      {buscando && !seleccion && (
        <p role="status" className="muted">
          Consultando vale
        </p>
      )}
      <section
        className="stack atencion-pendientes"
        aria-label="Vales autorizados"
      >
        <h2>Vales autorizados</h2>
        <ValesList
          key={busqueda}
          vales={lista}
          vista="solicitudes"
          onOpen={onOpen}
          emptyMessage="No hay vales autorizados para esta búsqueda."
          primaryAction={{
            title: "Atender",
            icon: <Fuel aria-hidden="true" />,
            label: (v) => "Atender vale " + v.codigo_vale + " de " + v.zonal,
            onClick: (v) => void abrirFila(v),
            disabled: buscando,
            mobileCard: {
              label: (v) =>
                "Abrir opciones del vale " + v.codigo_vale + " de " + v.zonal,
              onClick: (v) => {
                setError(undefined);
                setSeleccion(v);
              },
            },
          }}
        />
      </section>
      {seleccion && (
        <SeleccionAtencion
          vale={seleccion}
          consultando={buscando}
          error={error}
          onAtender={(v) => void abrirFila(v)}
          onDetalle={onOpen}
          onClose={() => {
            setSeleccion(undefined);
            setError(undefined);
          }}
        />
      )}
      {lector && (
        <Scanner
          onCancel={() => setLector(false)}
          onRead={async (texto, signal) => {
            const referencia = referenciaQr(texto);
            if (!referencia)
              throw new Error("Este QR no corresponde a un vale.");
            await consultarVale(referencia, signal);
          }}
        />
      )}
      {vale && (
        <FormularioDespacho
          key={vale.id_qr}
          vale={vale}
          onOpen={onOpen}
          onClose={() => {
            setVale(undefined);
            enfocarBusqueda();
          }}
          onSaved={(guardado) => {
            setVale(undefined);
            setCopia("");
            setRecibo(guardado);
            void invalidarDetalles(cache, [guardado]);
            void refresh(contextoConsulta.queryKey, ["facturas-grifo"]);
          }}
        />
      )}
    </div>
  );
}
