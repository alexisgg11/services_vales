import {
  lazy,
  Suspense,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FormEvent, MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  House,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  WandSparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorText } from "@/components/ui/feedback";
import { Field } from "@/components/formularios/campos";
import { useModal } from "@/components/dialogos/confirmacion";
import { api, today } from "@/lib/api";
import type {
  ContextoRutas,
  Coordenadas,
  Cuenta,
  PuntoPartidaRuta,
  RutaTrabajo,
} from "@/lib/types";
import { mostrarDistancia, origenValido } from "@/lib/geografia/coordenadas";
import { origenDeRuta, origenLocalidad } from "@/lib/geografia/origenes";
import { SelectorLocalidadOrigen } from "@/components/mapas/SelectorLocalidadOrigen";
import {
  confirmarPunto,
  datosParaGuardarRuta,
  partidaDelBorrador,
  validarRuta,
  type BorradorRuta,
  type ModoPunto,
  type ParadaBorrador,
  type SeccionRuta,
} from "./rutas-borrador";
import { ListaParadasRuta } from "./ListaParadasRuta";
import { SelectorOperativosRuta } from "./SelectorOperativosRuta";
import {
  ResumenRecorridoVial,
  type RecorridoVial,
} from "./ResumenRecorridoVial";

const MapaParadas = lazy(() =>
  import("@/components/mapas/MapaRecorrido").then((m) => ({
    default: m.MapaParadas,
  })),
);

type EdicionMapa =
  | {
      tipo: "parada";
      clave: number;
      modo: ModoPunto;
      punto?: Coordenadas;
      referencia?: Coordenadas;
    }
  | {
      tipo: "partida";
      localidad: string;
      punto?: PuntoPartidaRuta;
    };

type OptimizacionParadas = {
  orden: number[];
  distanciaActualKm: number | null;
  distanciaOptimaKm: number;
};

export function EditorRuta({
  cuenta,
  contexto,
  ruta,
  onClose,
  onSaved,
}: {
  cuenta: Cuenta;
  contexto: ContextoRutas;
  ruta: RutaTrabajo | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const zonas = cuenta.zonales.filter((zona) =>
    cuenta.roles.some(
      (rol) => rol.codigo_rol === "JEFE" && rol.cod_zonal === zona.id_zona,
    ),
  );
  const [inicial] = useState<BorradorRuta>(() => {
    const fecha = today();
    return {
      nombre: ruta?.nombre ?? "",
      cod_zonal: ruta?.cod_zonal ?? zonas[0]?.id_zona ?? "",
      desde: ruta?.desde ?? fecha,
      hasta: ruta?.hasta ?? fecha,
      activa: ruta?.activa ?? true,
      version: ruta?.version ?? 1,
      trabajadores: ruta?.trabajadores ?? [],
      origen: ruta?.origen,
      paradas:
        ruta?.paradas.map(({ nombre, centro, latitud, longitud }, clave) => ({
          clave,
          nombre,
          centro,
          punto: { latitud, longitud },
        })) ?? [],
    };
  });
  const [f, setF] = useState(inicial);
  const [seccion, setSeccion] = useState<SeccionRuta>("datos");
  const [paradaActiva, setParadaActiva] = useState<number>();
  const [mapa, setMapa] = useState<EdicionMapa>();
  const [ampliado, setAmpliado] = useState(false);
  const [error, setError] = useState<unknown>();
  const [guardando, setGuardando] = useState(false);
  const [optimizando, setOptimizando] = useState(false);
  const [optimizacion, setOptimizacion] = useState<
    OptimizacionParadas & { ordenAnterior: number[] }
  >();
  const mostrarModal = useModal();
  const idParadas = useId();
  const contenido = useRef<HTMLDivElement>(null);
  const panelMapa = useRef<HTMLElement>(null);
  const arrastrando = useRef(false);
  const siguienteClave = useRef(f.paradas.length);
  const ocupado = guardando || optimizando;
  const accionOptimizacion = optimizacion
    ? "Restaurar orden anterior"
    : "Optimizar orden de paradas";

  const operativos = contexto.trabajadores.filter(
    (t) => t.zonal === f.cod_zonal,
  );
  const origen = partidaDelBorrador(cuenta, f, contexto.trabajadores);
  const edicionParada = mapa?.tipo === "parada" ? mapa : undefined;
  const edicionPartida = mapa?.tipo === "partida" ? mapa : undefined;
  const vistaMapa = edicionParada
    ? edicionParada.clave + "-" + edicionParada.modo
    : (mapa?.tipo ?? "vista");
  const indice = f.paradas.findIndex((p) => p.clave === paradaActiva);
  const pines = useMemo(
    () =>
      f.paradas.flatMap((p, i) =>
        p.punto && origenValido(p.punto)
          ? [{ ...p.punto, centro: p.centro, nombre: p.nombre, orden: i + 1 }]
          : [],
      ),
    [f.paradas],
  );
  const referenciaMapa = origenLocalidad(cuenta, cuenta.trabajador.localidad);
  const consultaVial =
    f.cod_zonal &&
    origen &&
    pines.length > 0 &&
    pines.length === f.paradas.length
      ? {
          zonal: f.cod_zonal,
          origen: { latitud: origen.latitud, longitud: origen.longitud },
          paradas: pines.map(({ latitud, longitud }) => ({
            latitud,
            longitud,
          })),
        }
      : undefined;
  const mostrarTrazado = seccion === "paradas" && !mapa && !!consultaVial;
  const vial = useQuery({
    queryKey: ["trazado-jefatura", cuenta.actor, consultaVial],
    queryFn: ({ signal }) =>
      api<RecorridoVial>(
        "/api/v1/autorizacion/rutas/trazado",
        consultaVial,
        signal,
      ),
    enabled: mostrarTrazado,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const recorrido = mostrarTrazado ? vial.data : undefined;

  useLayoutEffect(() => {
    contenido.current?.scrollTo(0, 0);
  }, [seccion]);

  useLayoutEffect(() => {
    if (seccion !== "paradas") return;
    if (vistaMapa !== "vista") {
      panelMapa.current?.focus({ preventScroll: true });
    } else if (paradaActiva !== undefined) {
      document
        .getElementById(idParadas + "-parada-" + paradaActiva)
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [seccion, vistaMapa, paradaActiva, idParadas]);

  function enfocarParada(clave?: number) {
    const id =
      clave === undefined
        ? idParadas + "-agregar"
        : idParadas + "-parada-" + clave;
    requestAnimationFrame(() => document.getElementById(id)?.focus());
  }

  function actualizar(cambio: Partial<BorradorRuta>) {
    setError(undefined);
    if (
      cambio.paradas ||
      "origen" in cambio ||
      "cod_zonal" in cambio ||
      (!f.origen && "trabajadores" in cambio)
    ) {
      setOptimizacion(undefined);
    }
    setF((actual) => ({ ...actual, ...cambio }));
  }

  function actualizarParada(nueva: ParadaBorrador) {
    actualizar({
      paradas: f.paradas.map((p) => (p.clave === nueva.clave ? nueva : p)),
    });
  }

  function asignar(id: number, seleccionado: boolean) {
    const trabajadores = seleccionado
      ? [...f.trabajadores, id]
      : f.trabajadores.filter((trabajador) => trabajador !== id);
    const seleccionInicial =
      trabajadores.length === inicial.trabajadores.length &&
      inicial.trabajadores.every((trabajador) =>
        trabajadores.includes(trabajador),
      );
    actualizar({
      trabajadores: seleccionInicial ? inicial.trabajadores : trabajadores,
    });
  }

  function agregarParada() {
    const clave = siguienteClave.current++;
    actualizar({
      paradas: [...f.paradas, { clave, nombre: "", centro: null }],
    });
    setParadaActiva(clave);
    enfocarParada(clave);
  }

  function alternarParada(clave: number) {
    setMapa(undefined);
    setError(undefined);
    setParadaActiva(paradaActiva === clave ? undefined : clave);
  }

  function elegirParadaEnMapa(orden: number) {
    const parada = f.paradas[orden - 1];
    if (!parada) return;
    setError(undefined);
    setAmpliado(false);
    setParadaActiva(parada.clave);
    enfocarParada(parada.clave);
  }

  function quitarParada(clave: number) {
    const posicion = f.paradas.findIndex((p) => p.clave === clave);
    const paradas = f.paradas.filter((p) => p.clave !== clave);
    actualizar({ paradas });
    if (paradaActiva === clave) setParadaActiva(undefined);
    if (edicionParada?.clave === clave) setMapa(undefined);
    enfocarParada(paradas[Math.min(posicion, paradas.length - 1)]?.clave);
  }

  function abrirMapa(parada: ParadaBorrador, modo: ModoPunto) {
    const centro = contexto.centros.find((c) => c.codigo === parada.centro);
    const localidad =
      cuenta.localidades.find(
        (l) =>
          l.nom_localidad === centro?.localidad && l.id_zona === f.cod_zonal,
      ) ??
      cuenta.localidades.find((l) => l.nom_localidad === centro?.localidad);
    const referencia =
      parada.punto ??
      (localidad && origenLocalidad(cuenta, localidad.id_localidad)) ??
      pines.at(-1) ??
      origen ??
      referenciaMapa;
    setError(undefined);
    setMapa({
      tipo: "parada",
      clave: parada.clave,
      modo,
      referencia,
      punto: modo === "libre" && parada.centro ? undefined : parada.punto,
    });
  }

  function abrirPartida() {
    if (ocupado || arrastrando.current) return;
    setError(undefined);
    setMapa({
      tipo: "partida",
      localidad: origen?.localidad ?? "",
      punto: origen,
    });
  }

  function cambiarLocalidadPartida(localidad: string) {
    setMapa((actual) =>
      actual?.tipo === "partida"
        ? { ...actual, localidad, punto: origenLocalidad(cuenta, localidad) }
        : actual,
    );
  }

  function cancelarPunto() {
    if (edicionParada) enfocarParada(edicionParada.clave);
    if (edicionPartida) requestAnimationFrame(() => panelMapa.current?.focus());
    setMapa(undefined);
  }

  function cambioDelPunto(): Partial<BorradorRuta> | undefined {
    const punto = mapa?.punto;
    if (!mapa || !punto || !origenValido(punto)) return;
    if (mapa.tipo === "partida") return { origen: mapa.punto };
    return {
      paradas: f.paradas.map((parada) =>
        parada.clave === mapa.clave
          ? confirmarPunto(parada, punto, mapa.modo, contexto.centros)
          : parada,
      ),
    };
  }

  function usarPunto(evento: MouseEvent<HTMLButtonElement>) {
    evento.preventDefault();
    const cambio = cambioDelPunto();
    if (!cambio) return;
    actualizar(cambio);
    cancelarPunto();
  }

  function estadoDelBorrador(borrador: BorradorRuta) {
    const partida = partidaDelBorrador(cuenta, borrador, contexto.trabajadores);
    return JSON.stringify(datosParaGuardarRuta(borrador, partida));
  }

  function pedirCierre() {
    if (ocupado || arrastrando.current) return;
    const original = estadoDelBorrador(inicial);
    const actual = estadoDelBorrador(f);
    const cambio = cambioDelPunto();
    const puntoSinAplicar =
      cambio && estadoDelBorrador({ ...f, ...cambio }) !== actual;
    if (original === actual && !puntoSinAplicar) {
      onClose();
      return;
    }
    mostrarModal({
      title: "¿Descartar los cambios?",
      body: <p>La ruta tiene cambios sin guardar.</p>,
      cancelLabel: "Seguir editando",
      label: "Descartar cambios",
      action: async () => onClose(),
    });
  }

  async function optimizar() {
    if (ocupado || mapa || arrastrando.current || f.paradas.length < 2) return;
    if (optimizacion) {
      const porClave = new Map(f.paradas.map((p) => [p.clave, p]));
      actualizar({
        paradas: optimizacion.ordenAnterior.map((clave) =>
          porClave.get(clave)!,
        ),
      });
      return;
    }
    if (!origen || !origenValido(origen)) {
      setError("Define el punto de partida antes de optimizar.");
      return;
    }
    const puntos = f.paradas.map(({ punto }) => punto);
    const sinUbicar = puntos.findIndex((p) => !p || !origenValido(p));
    if (sinUbicar >= 0) {
      const clave = f.paradas[sinUbicar].clave;
      setParadaActiva(clave);
      enfocarParada(clave);
      setError(
        `Ubica la parada ${sinUbicar + 1} en el mapa antes de optimizar.`,
      );
      return;
    }
    setOptimizando(true);
    setError(undefined);
    try {
      const resultado = await api<OptimizacionParadas>(
        "/api/v1/autorizacion/rutas/optimizar",
        {
          zonal: f.cod_zonal,
          origen: { latitud: origen.latitud, longitud: origen.longitud },
          paradas: puntos,
        },
      );
      actualizar({ paradas: resultado.orden.map((i) => f.paradas[i]) });
      setOptimizacion({
        ...resultado,
        ordenAnterior: f.paradas.map((p) => p.clave),
      });
    } catch (e) {
      setError(e);
    } finally {
      setOptimizando(false);
    }
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (ocupado || mapa || arrastrando.current) return;
    const incidencia = validarRuta({ ...f, origen }, operativos, !ruta);
    if (incidencia) {
      setSeccion(incidencia.seccion);
      if (incidencia.parada != null) {
        setParadaActiva(incidencia.parada);
        enfocarParada(incidencia.parada);
      }
      setError(incidencia.mensaje);
      return;
    }
    setGuardando(true);
    setError(undefined);
    try {
      await api(
        "/api/v1/autorizacion/rutas" + (ruta ? "/" + ruta.id : ""),
        datosParaGuardarRuta(f, origen),
      );
      onSaved();
    } catch (e) {
      setError(e);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && pedirCierre()}>
      <DialogContent
        className="route-dialog"
        data-seccion={seccion}
        data-ampliado={ampliado}
        onEscapeKeyDown={(evento) => {
          if (arrastrando.current) evento.preventDefault();
          else if (ampliado) {
            evento.preventDefault();
            setAmpliado(false);
          } else if (mapa) {
            evento.preventDefault();
            cancelarPunto();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {ruta ? "Editar ruta" : "Nueva ruta de trabajo"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Configura las fechas y el punto de partida, asigna operativos y
            ordena los lugares de trabajo.
          </DialogDescription>
        </DialogHeader>
        <form className="route-form" noValidate onSubmit={guardar}>
          <Tabs
            value={seccion}
            onValueChange={(valor) => {
              setSeccion(valor as SeccionRuta);
              setError(undefined);
              setMapa(undefined);
              setAmpliado(false);
            }}
            className="route-tabs"
          >
            <div className="route-tabs-bar">
              <TabsList variant="line" aria-label="Configuración de la ruta">
                <TabsTrigger value="datos" disabled={ocupado}>
                  Datos
                </TabsTrigger>
                <TabsTrigger value="operativos" disabled={ocupado}>
                  Operativos
                </TabsTrigger>
                <TabsTrigger value="paradas" disabled={ocupado}>
                  Paradas
                </TabsTrigger>
              </TabsList>
            </div>
            {error != null && (
              <div className="route-feedback">
                <ErrorText error={error} />
              </div>
            )}
            <div
              className="route-form-body"
              hidden={seccion === "paradas"}
              ref={contenido}
            >
              <fieldset className="route-fields" disabled={ocupado}>
                <TabsContent value="datos" className="route-panel">
                  <div className="form-grid route-data-fields">
                    <div className="full">
                      <Field label="Nombre del trabajo o recorrido">
                        <Input
                          required
                          maxLength={120}
                          value={f.nombre}
                          onChange={(e) =>
                            actualizar({ nombre: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                    <div className="full">
                      <Field label="Zonal responsable">
                        {zonas.length === 1 ? (
                          <Input value={zonas[0].nom_zona} disabled />
                        ) : (
                          <select
                            value={f.cod_zonal}
                            onChange={(e) =>
                              actualizar({
                                cod_zonal: e.target.value,
                                trabajadores: [],
                              })
                            }
                          >
                            {zonas.map((z) => (
                              <option key={z.id_zona} value={z.id_zona}>
                                {z.nom_zona}
                              </option>
                            ))}
                          </select>
                        )}
                      </Field>
                    </div>
                    <Field label="Desde">
                      <Input
                        type="date"
                        required
                        value={f.desde}
                        onChange={(e) => actualizar({ desde: e.target.value })}
                      />
                    </Field>
                    <Field label="Hasta">
                      <Input
                        type="date"
                        required
                        min={f.desde}
                        value={f.hasta}
                        onChange={(e) => actualizar({ hasta: e.target.value })}
                      />
                    </Field>
                  </div>
                  <label className="route-active">
                    <input
                      type="checkbox"
                      checked={f.activa}
                      onChange={(e) => actualizar({ activa: e.target.checked })}
                    />
                    Ruta habilitada
                  </label>
                </TabsContent>
                <TabsContent value="operativos" className="route-panel">
                  <SelectorOperativosRuta
                    operativos={operativos}
                    seleccionados={f.trabajadores}
                    disabled={ocupado}
                    onChange={asignar}
                  />
                </TabsContent>
              </fieldset>
            </div>
            <TabsContent
              value="paradas"
              className="route-stops-layout"
              data-editando={!!mapa}
              data-ampliado={ampliado}
            >
              <section
                className="route-map-panel"
                aria-labelledby={idParadas + "-mapa"}
                ref={panelMapa}
                tabIndex={-1}
              >
                <div
                  className={
                    mapa || !origen
                      ? "route-map-heading"
                      : "route-map-heading max-[700px]:sr-only"
                  }
                >
                  <h3 id={idParadas + "-mapa"}>
                    {edicionPartida
                      ? "Punto de partida"
                      : edicionParada
                        ? "Ubicar parada " + (indice + 1)
                        : "Mapa del recorrido"}
                  </h3>
                  {mapa && !mapa.punto && (
                    <p className="muted">
                      Toca el mapa para marcar la ubicación.
                    </p>
                  )}
                </div>
                {!mapa && !origen && (
                  <Button
                    type="button"
                    className="route-pick-start"
                    variant="outline"
                    disabled={ocupado}
                    onClick={abrirPartida}
                  >
                    <House aria-hidden="true" /> Elegir partida
                  </Button>
                )}
                {edicionPartida && (
                  <SelectorLocalidadOrigen
                    cuenta={cuenta}
                    label="Localidad de partida"
                    localidad={edicionPartida.localidad}
                    onChange={cambiarLocalidadPartida}
                  />
                )}
                <Suspense
                  fallback={
                    <p className="route-map-loading" role="status">
                      Cargando mapa
                    </p>
                  }
                >
                  <MapaParadas
                    key={vistaMapa}
                    ampliado={ampliado}
                    onAmpliar={() => setAmpliado((actual) => !actual)}
                    ordenMeta={f.paradas.length}
                    paradas={
                      edicionParada
                        ? pines.filter((p) => p.orden !== indice + 1)
                        : pines
                    }
                    origen={
                      edicionPartida
                        ? origenDeRuta(cuenta, edicionPartida.punto)
                        : origen
                    }
                    referencia={origen ?? pines[0] ?? referenciaMapa}
                    trazado={recorrido?.trazado}
                    ordenActiva={indice >= 0 ? indice + 1 : undefined}
                    onElegirParada={
                      mapa || ocupado ? undefined : elegirParadaEnMapa
                    }
                    onEditarOrigen={mapa || ocupado ? undefined : abrirPartida}
                    alMoverOrigen={
                      edicionPartida
                        ? (punto) =>
                            setMapa((actual) =>
                              actual?.tipo === "partida"
                                ? { ...actual, localidad: "", punto }
                                : actual,
                            )
                        : undefined
                    }
                    edicion={
                      edicionParada && {
                        orden: indice + 1,
                        punto: edicionParada.punto,
                        referencia: edicionParada.referencia,
                        onPunto: (punto) =>
                          setMapa((actual) =>
                            actual?.tipo === "parada"
                              ? { ...actual, punto }
                              : actual,
                          ),
                      }
                    }
                  />
                </Suspense>
                {recorrido && <ResumenRecorridoVial recorrido={recorrido} />}
                {mostrarTrazado && !recorrido && (
                  <div className="route-map-summary route-map-feedback">
                    <p role="status">
                      {vial.isFetching
                        ? "Trazando recorrido por calles…"
                        : vial.isPaused
                          ? "Trazado pendiente de conexión"
                          : "No se pudo trazar por calles"}
                    </p>
                    {vial.isError && !vial.isFetching && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Reintentar trazado"
                        title="Reintentar trazado"
                        onClick={() => void vial.refetch()}
                      >
                        <RefreshCw aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                )}
                {mapa && (
                  <div className="route-point-actions route-map-actions">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={cancelarPunto}
                    >
                      Cancelar punto
                    </Button>
                    <Button
                      type="button"
                      disabled={!mapa.punto || !origenValido(mapa.punto)}
                      onClick={usarPunto}
                    >
                      {edicionPartida ? "Usar partida" : "Usar punto"}
                    </Button>
                  </div>
                )}
              </section>
              <section
                className="route-list-panel"
                aria-labelledby={idParadas + "-orden"}
              >
                <div className="route-stop-toolbar">
                  <h3 id={idParadas + "-orden"}>Orden de visita</h3>
                  <div className="route-stop-actions">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="route-optimize-button"
                      aria-label={accionOptimizacion}
                      title={accionOptimizacion}
                      aria-pressed={!!optimizacion}
                      disabled={f.paradas.length < 2 || !!mapa || ocupado}
                      onClick={optimizar}
                    >
                      {optimizando ? (
                        <LoaderCircle className="spin" aria-hidden="true" />
                      ) : (
                        <WandSparkles aria-hidden="true" />
                      )}
                    </Button>
                    <Button
                      id={idParadas + "-agregar"}
                      type="button"
                      variant="outline"
                      disabled={f.paradas.length >= 8 || !!mapa || ocupado}
                      onClick={agregarParada}
                    >
                      <Plus /> Añadir parada
                    </Button>
                  </div>
                </div>
                {optimizando && (
                  <p className="route-optimization-status" role="status">
                    Comparando recorridos por carretera…
                  </p>
                )}
                {optimizacion && (
                  <p className="route-optimization-status" role="status">
                    {optimizacion.orden.every((p, i) => p === i)
                      ? "El orden actual ya es el más corto"
                      : "Recorrido optimizado"}
                    <strong>
                      {optimizacion.distanciaActualKm != null &&
                        optimizacion.distanciaActualKm >
                          optimizacion.distanciaOptimaKm &&
                        mostrarDistancia(optimizacion.distanciaActualKm) +
                          " → "}
                      {mostrarDistancia(optimizacion.distanciaOptimaKm)}
                    </strong>
                  </p>
                )}
                {f.paradas.length ? (
                  <div
                    className="route-stop-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label="Paradas de la ruta"
                  >
                    <fieldset className="route-fields" disabled={ocupado}>
                      <ListaParadasRuta
                        id={idParadas}
                        paradas={f.paradas}
                        centros={contexto.centros}
                        activa={paradaActiva}
                        ubicando={!!mapa}
                        guardando={ocupado}
                        onAlternar={alternarParada}
                        onQuitar={quitarParada}
                        onActualizar={actualizarParada}
                        onUbicar={abrirMapa}
                        onOrdenar={(paradas) => actualizar({ paradas })}
                        onArrastre={(activo) => {
                          arrastrando.current = activo;
                        }}
                      />
                    </fieldset>
                  </div>
                ) : (
                  <p className="route-empty-stops">
                    Añade el primer lugar de trabajo.
                  </p>
                )}
              </section>
            </TabsContent>
          </Tabs>
          <div className="route-footer">
            <Button
              type="button"
              variant="outline"
              disabled={ocupado}
              onClick={pedirCierre}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={ocupado || !!mapa}>
              <Save /> {guardando ? "Guardando" : "Guardar ruta"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
