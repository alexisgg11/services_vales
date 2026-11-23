import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Expand, LoaderCircle, Navigation, Shrink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/api";
import type { Coordenadas, Recomendacion, ParadaTrabajo } from "@/lib/types";
import {
  mostrarDistancia,
  origenValido,
  type OrigenTrabajo,
} from "@/lib/geografia/coordenadas";
import { nombreOrigen } from "@/lib/geografia/origenes";

interface EdicionParada {
  orden: number;
  punto?: Coordenadas;
  referencia?: Coordenadas;
  onPunto: (punto: Coordenadas) => void;
}

interface Props {
  opciones?: Recomendacion[];
  origen?: OrigenTrabajo;
  ubicacionActual?: OrigenTrabajo;
  recomendado?: string;
  editarOrigen?: boolean;
  onUbicacion?: () => void;
  localizando?: boolean;
  onOrigenChange?: (punto: Coordenadas) => void;
  paradas?: ParadaTrabajo[];
  trazado?: number[][];
  mapaDeParadas?: boolean;
  edicionParada?: EdicionParada;
  ordenMeta?: number;
  ordenActiva?: number;
  referenciaMapa?: Coordenadas;
  onElegirParada?: (orden: number) => void;
  onEditarOrigen?: () => void;
  ampliado?: boolean;
  onAmpliar?: () => void;
}

const sinGrifos: Recomendacion[] = [];
const iconosMapa = {
  origen:
    '<path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 21v-8h6v8"/>',
  meta: '<path d="M4 21V4h16v12H4"/><path fill="currentColor" stroke="none" d="M4 4h5.33v6H4zm5.33 6h5.34v6H9.33zm5.34-6H20v6h-5.33z"/>',
  grifo:
    '<path d="M3 22h12M4 9h10m0 13V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18m10-9h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V9.83a2 2 0 0 0-.59-1.42L18 5"/>',
};

function simboloMapa(tipo: keyof typeof iconosMapa) {
  return `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconosMapa[tipo]}</svg>`;
}

export function MapaParadas({
  paradas,
  edicion,
  ordenMeta,
  ordenActiva,
  referencia,
  origen,
  trazado,
  onElegirParada,
  onEditarOrigen,
  alMoverOrigen,
  ampliado,
  onAmpliar,
}: {
  paradas: ParadaTrabajo[];
  edicion?: EdicionParada;
  ordenMeta: number;
  ordenActiva?: number;
  referencia?: Coordenadas;
  origen?: OrigenTrabajo;
  trazado?: number[][];
  onElegirParada?: (orden: number) => void;
  onEditarOrigen?: () => void;
  alMoverOrigen?: (punto: Coordenadas) => void;
  ampliado: boolean;
  onAmpliar: () => void;
}) {
  return (
    <MapaGrifos
      mapaDeParadas
      paradas={paradas}
      origen={origen}
      trazado={trazado}
      editarOrigen={!!alMoverOrigen}
      onOrigenChange={alMoverOrigen}
      edicionParada={edicion}
      ordenMeta={ordenMeta}
      ordenActiva={ordenActiva}
      referenciaMapa={referencia}
      onElegirParada={onElegirParada}
      onEditarOrigen={onEditarOrigen}
      ampliado={ampliado}
      onAmpliar={onAmpliar}
    />
  );
}

function iconoParada(orden: number, esMeta: boolean, resaltada = false) {
  const contenido = document.createElement("span");
  contenido.setAttribute("aria-hidden", "true");
  if (esMeta) contenido.innerHTML = simboloMapa("meta");
  else contenido.textContent = String(orden);
  return L.divIcon({
    className:
      "map-work-pin" +
      (esMeta ? " is-destination" : "") +
      (resaltada ? " is-highlighted" : ""),
    html: contenido,
    iconSize: [40, 44],
    iconAnchor: [20, 34],
    tooltipAnchor: [0, -31],
    popupAnchor: [0, -29],
  });
}

function detallePunto(nombre: string, tipo?: string) {
  const detalle = document.createElement("div");
  detalle.className = "map-point-info";
  if (tipo) {
    const etiqueta = document.createElement("small");
    etiqueta.textContent = tipo;
    detalle.append(etiqueta);
  }
  const titulo = document.createElement("strong");
  titulo.textContent = nombre;
  detalle.append(titulo);
  return detalle;
}

function detalleGrifo(o: Recomendacion, recomendado: boolean) {
  const detalle = detallePunto(
    o.nombre,
    recomendado ? "Recomendado" : undefined,
  );
  const datos = document.createElement("dl");
  for (const [etiqueta, valor] of [
    ["Precio por galón", money(o.precio)],
    ["Desvío adicional", mostrarDistancia(o.distanciaKm)],
    ["Total estimado", money(o.estimado)],
  ]) {
    const fila = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = etiqueta;
    dd.textContent = valor;
    fila.append(dt, dd);
    datos.append(fila);
  }
  detalle.append(datos);
  return detalle;
}

function mostrarDetalle(
  mapa: L.Map,
  marker: L.Marker,
  etiqueta: string,
  detalle: HTMLElement,
) {
  const elemento = marker.getElement();
  elemento?.setAttribute("aria-label", etiqueta);
  marker.bindTooltip(detalle, {
    direction: "auto",
    offset: [12, 0],
    opacity: 1,
    className: "map-point-tooltip",
  });
  const separacion = L.point(0, 7);
  const ficha = L.popup({
    offset: separacion,
    maxWidth: 220,
    autoPan: false,
    className: "map-point-popup",
  }).setContent(detalle.cloneNode(true) as HTMLElement);
  marker.bindPopup(ficha);
  marker.on("popupopen", () => {
    marker.closeTooltip();
    const ventana = ficha.getElement();
    const punto = marker.getElement()?.getBoundingClientRect();
    if (!ventana || !punto) return;
    ventana
      .querySelector(".leaflet-popup-close-button")
      ?.setAttribute("aria-label", "Cerrar información");
    const area = mapa.getContainer().getBoundingClientRect();
    const caja = ventana.getBoundingClientRect();
    const margen = 8;
    const hueco = 12;
    const faltaAltura = caja.top < area.top + margen;
    const lateral = faltaAltura
      ? [punto.right + hueco, punto.left - hueco - caja.width].find(
          (x) =>
            x >= area.left + margen && x + caja.width <= area.right - margen,
        )
      : undefined;
    const debajo = punto.bottom + hueco;
    const invertir =
      faltaAltura &&
      lateral === undefined &&
      debajo + caja.height <= area.bottom - margen;
    const x = Math.max(
      area.left + margen,
      Math.min(lateral ?? caja.left, area.right - margen - caja.width),
    );
    const superior =
      lateral === undefined
        ? caja.top
        : (punto.top + punto.bottom - caja.height) / 2;
    const y = invertir
      ? debajo
      : Math.max(
          area.top + margen,
          Math.min(superior, area.bottom - margen - caja.height),
        );
    ventana.classList.toggle("is-below", invertir);
    ventana.classList.toggle(
      "is-offset",
      lateral !== undefined || (!invertir && y !== caja.top),
    );
    ventana.style.setProperty("--tip-offset-x", `${caja.left - x}px`);
    ficha.options.offset = separacion.add([x - caja.left, y - caja.top]);
    ficha.update();
  });
  marker.on("popupclose", () => {
    ficha.options.offset = separacion;
  });
  marker.on("tooltipopen", () => {
    if (marker.isPopupOpen()) marker.closeTooltip();
  });
  elemento?.addEventListener("keydown", (evento) => {
    if (evento.key !== " ") return;
    evento.preventDefault();
    marker.togglePopup();
  });
}

export function MapaGrifos(props: Props) {
  const opciones = props.opciones ?? sinGrifos;
  const div = useRef<HTMLDivElement>(null),
    mapa = useRef<L.Map | null>(null),
    capas = useRef<L.LayerGroup | null>(null),
    pinPrincipal = useRef<L.Marker | null>(null),
    ultimaVista = useRef<string | null>(null),
    ultimoGPS = useRef(""),
    callbacks = useRef(props);
  callbacks.current = props;
  const puedeElegirParada = !!props.onElegirParada;
  const puedeEditarOrigen = !!props.onEditarOrigen;
  useEffect(() => {
    if (props.trazado?.length) encuadrar();
  }, [props.trazado]);
  function guardar(latlng: L.LatLng) {
    const punto = latlng.wrap(),
      nuevo = { latitud: punto.lat, longitud: punto.lng };
    if (!origenValido(nuevo)) return;
    const actual = callbacks.current;
    if (actual.edicionParada) actual.edicionParada.onPunto(nuevo);
    else if (actual.editarOrigen) actual.onOrigenChange?.(nuevo);
  }
  function encuadrar(todos = false) {
    const p = callbacks.current;
    if (p.edicionParada) return;
    const esRecomendacion = p.recomendado !== undefined;
    const visibles = p.opciones?.filter(
      (o) =>
        o.latitud != null &&
        o.longitud != null &&
        (todos || o.proveedor === p.recomendado),
    );
    const puntos: L.LatLngExpression[] = (visibles ?? []).map((o) => [
      o.latitud!,
      o.longitud!,
    ]);
    if (p.origen) puntos.push([p.origen.latitud, p.origen.longitud]);
    if (p.ubicacionActual)
      puntos.push([p.ubicacionActual.latitud, p.ubicacionActual.longitud]);
    p.paradas?.forEach((s) => puntos.push([s.latitud, s.longitud]));
    p.trazado?.forEach((s) => puntos.push([s[0], s[1]]));
    if (!puntos.length) return;
    const vista: L.FitBoundsOptions = esRecomendacion
      ? {
          paddingTopLeft: [23, 35],
          paddingBottomRight: [23, 30],
          maxZoom: 18,
        }
      : {
          paddingTopLeft: p.mapaDeParadas ? [32, 30] : [20, 28],
          paddingBottomRight: p.mapaDeParadas ? [44, 46] : [20, 48],
          maxZoom: p.mapaDeParadas ? 17 : 14,
        };
    mapa.current?.fitBounds(L.latLngBounds(puntos), {
      ...vista,
      animate: false,
    });
  }
  useEffect(() => {
    if (!div.current) return;
    ultimaVista.current = null;
    ultimoGPS.current = "";
    const edicion = callbacks.current.edicionParada;
    const puntoInicial =
      edicion?.punto ?? edicion?.referencia ?? callbacks.current.referenciaMapa;
    const map = L.map(div.current, {
      worldCopyJump: true,
      scrollWheelZoom: !callbacks.current.mapaDeParadas,
      zoomSnap: callbacks.current.recomendado === undefined ? 1 : 0,
      fadeAnimation: !window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches,
      zoomControl: false,
    }).setView(
      puntoInicial
        ? [puntoInicial.latitud, puntoInicial.longitud]
        : [-9.19, -75.0152],
      puntoInicial ? 15 : 5,
    );
    mapa.current = map;
    L.control
      .zoom({
        position: "bottomleft",
        zoomInTitle: "Acercar",
        zoomOutTitle: "Alejar",
      })
      .addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    L.control.scale({ imperial: false }).addTo(map);
    capas.current = L.layerGroup().addTo(map);
    map.on("click", (e) => guardar(e.latlng));
    const elegirConTeclado = (evento: KeyboardEvent) => {
      if (
        evento.target === div.current &&
        evento.key === "Enter" &&
        (callbacks.current.editarOrigen || callbacks.current.edicionParada)
      ) {
        evento.preventDefault();
        guardar(map.getCenter());
      }
    };
    map.getContainer().addEventListener("keydown", elegirConTeclado);
    const resize = new ResizeObserver(() => {
      map.invalidateSize({ pan: !!callbacks.current.onAmpliar });
      encuadrar();
    });
    resize.observe(div.current);
    return () => {
      resize.disconnect();
      map.getContainer().removeEventListener("keydown", elegirConTeclado);
      map.remove();
      mapa.current = null;
      capas.current = null;
      pinPrincipal.current = null;
    };
  }, []);
  useEffect(() => {
    const map = mapa.current,
      grupo = capas.current;
    if (!map || !grupo) return;
    grupo.eachLayer((capa) => capa.closeTooltip());
    grupo.clearLayers();
    const { origen, ubicacionActual, recomendado, edicionParada } = props;
    const paradas = props.paradas ?? [];
    const ordenMeta =
      props.ordenMeta ?? props.paradas?.at(-1)?.orden ?? props.paradas?.length;
    if (props.trazado?.length) {
      L.polyline(
        props.trazado.map((p) => [p[0], p[1]] as [number, number]),
        {
          className: "map-road-trace",
          color: "#087f86",
          weight: 4,
          opacity: 0.9,
        },
      ).addTo(grupo);
    }
    paradas.forEach((p, i) => {
      const orden = p.orden ?? i + 1;
      const esMeta = orden === ordenMeta;
      const activa = orden === props.ordenActiva;
      const titulo = esMeta ? "Meta del recorrido" : `Parada ${orden}`;
      const etiqueta = p.nombre.trim() ? `${titulo}: ${p.nombre}` : titulo;
      const marker = L.marker([p.latitud, p.longitud], {
        icon: iconoParada(orden, esMeta, activa),
        title: props.mapaDeParadas ? etiqueta : undefined,
        zIndexOffset: activa ? 800 : 600,
      }).addTo(grupo);
      const elemento = marker.getElement();
      if (props.mapaDeParadas) {
        const texto = document.createElement("span");
        texto.textContent = etiqueta;
        elemento?.setAttribute("aria-label", etiqueta);
        marker.bindTooltip(texto, { direction: "top" });
      } else {
        mostrarDetalle(map, marker, etiqueta, detallePunto(p.nombre, titulo));
      }
      if (puedeElegirParada) {
        const elegir = () => callbacks.current.onElegirParada?.(orden);
        elemento?.setAttribute("aria-pressed", String(activa));
        marker.on("click", elegir);
        elemento?.addEventListener("keydown", (evento) => {
          if (evento.key !== " ") return;
          evento.preventDefault();
          elegir();
        });
      }
    });
    const principal = edicionParada ? edicionParada.punto : origen;
    if (principal) {
      const point: L.LatLngExpression = [principal.latitud, principal.longitud];
      const movible = !!(props.editarOrigen || edicionParada);
      const consultar = !props.mapaDeParadas && !movible;
      if (!pinPrincipal.current) {
        const titulo = edicionParada
          ? edicionParada.orden === ordenMeta
            ? "Meta del recorrido"
            : `Parada ${edicionParada.orden}`
          : "Punto de partida del trabajo";
        pinPrincipal.current = L.marker(point, {
          draggable: movible,
          autoPan: true,
          keyboard: true,
          zIndexOffset: 1000,
          title: consultar
            ? undefined
            : movible
              ? `${titulo}: arrastrar para mover`
              : titulo,
          icon: edicionParada
            ? iconoParada(
                edicionParada.orden,
                edicionParada.orden === ordenMeta,
                true,
              )
            : L.divIcon({
                className: "map-origin",
                html: `<span class="map-start-marker">${simboloMapa("origen")}</span>`,
                iconSize: [44, 44],
                iconAnchor: [22, 22],
                popupAnchor: [0, -18],
              }),
        }).addTo(map);
        pinPrincipal.current.getElement()?.setAttribute("aria-label", titulo);
        if (consultar) {
          const nombre = nombreOrigen(origen);
          mostrarDetalle(
            map,
            pinPrincipal.current,
            `Origen del trabajo: ${nombre}`,
            detallePunto(nombre, "Origen del trabajo"),
          );
        } else if (!edicionParada) {
          pinPrincipal.current.bindTooltip(titulo, {
            permanent: false,
            direction: "top",
            offset: [0, 3],
            className: "map-origin-label",
          });
          pinPrincipal.current.on("click", () =>
            callbacks.current.onEditarOrigen?.(),
          );
          pinPrincipal.current
            .getElement()
            ?.addEventListener("keydown", (evento) => {
              if (evento.key === " " && callbacks.current.onEditarOrigen) {
                evento.preventDefault();
                callbacks.current.onEditarOrigen();
              }
            });
        }
        pinPrincipal.current.on("dragend", () => {
          if (pinPrincipal.current) guardar(pinPrincipal.current.getLatLng());
        });
      } else pinPrincipal.current.setLatLng(point);
      if (!edicionParada && !consultar) {
        pinPrincipal.current
          .getElement()
          ?.setAttribute(
            "aria-label",
            puedeEditarOrigen
              ? "Cambiar punto de partida"
              : "Punto de partida del trabajo",
          );
      }
      if (movible) pinPrincipal.current.dragging?.enable();
      else pinPrincipal.current.dragging?.disable();
    } else if (pinPrincipal.current) {
      pinPrincipal.current.remove();
      pinPrincipal.current = null;
    }
    if (
      ubicacionActual &&
      (!origen ||
        ubicacionActual.latitud !== origen.latitud ||
        ubicacionActual.longitud !== origen.longitud)
    ) {
      L.circleMarker([ubicacionActual.latitud, ubicacionActual.longitud], {
        radius: 7,
        color: "#fff",
        weight: 3,
        fillColor: "#2563eb",
        fillOpacity: 1,
      })
        .addTo(grupo)
        .bindTooltip("Mi ubicación");
    }
    opciones
      .filter((o) => o.latitud != null && o.longitud != null)
      .forEach((o) => {
        const esRecomendado = o.proveedor === recomendado;
        const marker = L.marker([o.latitud!, o.longitud!], {
          riseOnHover: true,
          zIndexOffset: esRecomendado ? 900 : 0,
          icon: L.divIcon({
            className:
              "map-grifo-pin" + (esRecomendado ? " is-recommended" : ""),
            html: `<span>${simboloMapa("grifo")}</span>`,
            iconSize: [44, 44],
            iconAnchor: [22, 22],
            popupAnchor: [0, -16],
          }),
        }).addTo(grupo);
        mostrarDetalle(
          map,
          marker,
          esRecomendado ? `${o.nombre}, recomendado` : o.nombre,
          detalleGrifo(o, esRecomendado),
        );
      });
    const firma = opciones
      .map((o) => o.proveedor + ":" + o.latitud + ":" + o.longitud)
      .concat((props.paradas ?? []).map((p) => p.latitud + ":" + p.longitud))
      .sort()
      .join("|");
    const gps =
      origen && origen.fuente !== "mapa"
        ? `${origen.latitud},${origen.longitud}`
        : "";
    if (firma !== ultimaVista.current || (gps && gps !== ultimoGPS.current)) {
      ultimaVista.current = firma;
      if (gps) ultimoGPS.current = gps;
      encuadrar();
    }
  }, [
    opciones,
    props.origen,
    props.ubicacionActual,
    props.recomendado,
    props.editarOrigen,
    props.paradas,
    props.trazado,
    props.edicionParada,
    props.ordenMeta,
    props.ordenActiva,
    props.mapaDeParadas,
    puedeElegirParada,
    puedeEditarOrigen,
  ]);
  const editando = !!(props.editarOrigen || props.edicionParada);
  const accionMapa = props.onAmpliar
    ? props.ampliado
      ? "Restaurar tamaño del mapa"
      : "Expandir mapa"
    : "Ver todos los grifos";
  return (
    <div className="map-editor">
      <div className={"map-canvas " + (editando ? "editing" : "")}>
        <div
          className="map map-comparison"
          ref={div}
          role="region"
          aria-label={
            props.mapaDeParadas
              ? "Mapa de paradas"
              : props.editarOrigen
                ? "Mapa del origen del trabajo"
                : "Mapa de la ruta y los grifos"
          }
          aria-description={
            props.edicionParada
              ? "Toca el mapa o arrastra la parada. Con el teclado, usa las flechas y pulsa Intro para fijar el punto."
              : props.editarOrigen
                ? "Toca un punto o arrastra el origen. Con el teclado, mueve el mapa con las flechas y pulsa Intro para fijar el origen."
                : undefined
          }
        />
        {(!editando || props.onAmpliar) && (
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            className="map-fit"
            aria-label={accionMapa}
            title={accionMapa}
            onClick={props.onAmpliar ?? (() => encuadrar(true))}
          >
            {props.ampliado ? <Shrink /> : <Expand />}
          </Button>
        )}
        {props.editarOrigen && props.onUbicacion && (
          <Button
            type="button"
            variant="outline"
            className="map-location"
            onClick={props.onUbicacion}
            disabled={props.localizando}
          >
            {props.localizando ? (
              <LoaderCircle className="spin" />
            ) : (
              <Navigation />
            )}{" "}
            Usar ubicación
          </Button>
        )}
      </div>
      {editando && (
        <span className="sr-only" role="status">
          {props.edicionParada
            ? props.edicionParada.punto
              ? "Parada marcada en el mapa."
              : "Elige la ubicación de la parada."
            : props.origen
              ? props.mapaDeParadas
                ? "Punto de partida marcado en el mapa."
                : "Origen marcado en el mapa."
              : "Elige un punto de origen en el mapa."}
        </span>
      )}
    </div>
  );
}
