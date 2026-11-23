import { toCanvas } from "html-to-image";

const anchoEje = 42;

interface PuntoGrafico {
  periodo: string;
  x: number;
  y: number;
}

interface ImagenGastos {
  png: string;
  ancho: number;
  alto: number;
}

interface ImagenComparativo extends ImagenGastos {
  puntos: PuntoGrafico[];
}

async function copiarVista(elemento: HTMLElement, limites: DOMRect) {
  return await toCanvas(elemento, {
    width: Math.ceil(limites.width),
    height: Math.ceil(limites.height),
    pixelRatio: 2,
    skipFonts: true,
    style: { margin: "0" },
    filter: (nodo) =>
      !(
        nodo instanceof Element &&
        nodo.matches(".recharts-tooltip-wrapper, .recharts-tooltip-cursor")
      ),
  });
}

function imagen(canvas: HTMLCanvasElement, limites: DOMRect): ImagenGastos {
  return {
    png: canvas.toDataURL("image/png"),
    ancho: limites.width,
    alto: limites.height,
  };
}

function puntosDelGrafico(
  grafico: HTMLElement,
  limites: DOMRect,
): PuntoGrafico[] {
  return Array.from(
    grafico.querySelectorAll<SVGElement>("[data-periodo-pdf]"),
    (nodo) => {
      const caja = nodo.getBoundingClientRect();
      return {
        periodo: nodo.dataset.periodoPdf!,
        x: caja.left + caja.width / 2 - limites.left,
        y: caja.top + caja.height / 2 - limites.top,
      };
    },
  );
}

async function copiarComparativo(
  comparativo: HTMLElement,
): Promise<ImagenComparativo[]> {
  const limites = comparativo.getBoundingClientRect();
  const visor = comparativo.querySelector<HTMLElement>(
    ".gastos-grafico-scroll",
  );
  const grafico = visor?.querySelector<HTMLElement>(".gastos-grafico");
  const areaGrafico = grafico?.getBoundingClientRect();

  if (
    !visor ||
    !grafico ||
    !areaGrafico ||
    areaGrafico.width <= visor.clientWidth + 1
  ) {
    const puntos = grafico ? puntosDelGrafico(grafico, limites) : [];
    return [
      { ...imagen(await copiarVista(comparativo, limites), limites), puntos },
    ];
  }

  const areaVisor = visor.getBoundingClientRect();
  const anchoVista = visor.clientWidth;
  const xVista = areaVisor.left - limites.left;
  const yVista = areaGrafico.top - limites.top;
  const fondo = getComputedStyle(comparativo).backgroundColor;
  const puntos = puntosDelGrafico(grafico, areaGrafico);
  const posiciones = [...new Set(puntos.map(({ x }) => Math.round(x)))].sort(
    (a, b) => a - b,
  );
  const centros = posiciones
    .slice(1)
    .map((x, i) => Math.floor((x + posiciones[i]) / 2));
  const [marco, trazado] = await Promise.all([
    copiarVista(comparativo, limites),
    copiarVista(grafico, areaGrafico),
  ]);
  const escalaTrazado = trazado.width / areaGrafico.width;
  const tramos: ImagenComparativo[] = [];

  for (let inicio = 0; inicio < areaGrafico.width;) {
    const ejeRepetido = inicio ? anchoEje : 0;
    const maximo = Math.min(
      areaGrafico.width,
      inicio + anchoVista - ejeRepetido,
    );
    const fin =
      maximo === areaGrafico.width
        ? maximo
        : (centros
            .filter((x) => x > inicio && x < maximo && maximo - x <= 80)
            .at(-1) ?? maximo);

    const recorte = document.createElement("canvas");
    recorte.width = marco.width;
    recorte.height = marco.height;
    const ctx = recorte.getContext("2d");
    if (!ctx) throw new Error("No se pudo capturar el comparativo.");
    ctx.scale(recorte.width / limites.width, recorte.height / limites.height);
    ctx.drawImage(marco, 0, 0, limites.width, limites.height);
    ctx.fillStyle = fondo;
    ctx.fillRect(xVista, yVista, anchoVista, areaVisor.height);

    function copiarTramo(desde: number, ancho: number, x: number) {
      ctx!.drawImage(
        trazado,
        desde * escalaTrazado,
        0,
        ancho * escalaTrazado,
        trazado.height,
        x,
        yVista,
        ancho,
        areaGrafico!.height,
      );
    }

    if (ejeRepetido) copiarTramo(0, ejeRepetido, xVista);
    copiarTramo(inicio, fin - inicio, xVista + ejeRepetido);
    tramos.push({
      ...imagen(recorte, limites),
      puntos: puntos
        .filter((punto) => punto.x >= inicio && punto.x < fin)
        .map((punto) => ({
          periodo: punto.periodo,
          x: xVista + ejeRepetido + punto.x - inicio,
          y: yVista + punto.y,
        })),
    });
    inicio = fin;
  }
  return tramos;
}

export async function capturarGastos(
  indicadores: HTMLElement,
  comparativo: HTMLElement,
) {
  await document.fonts.ready;
  const limites = indicadores.getBoundingClientRect();
  const estilos = Array.from(
    comparativo.querySelectorAll<SVGElement>(
      ".recharts-surface text, .gastos-grafico-marca",
    ),
    (nodo) => {
      const original = nodo.getAttribute("style");
      const calculado = getComputedStyle(nodo);
      // El SVG clonado conserva sus atributos, pero no las hojas de estilo.
      for (const propiedad of [
        "font-size",
        "font-family",
        "font-weight",
        "fill",
        "opacity",
      ]) {
        nodo.style.setProperty(
          propiedad,
          calculado.getPropertyValue(propiedad),
        );
      }
      return { nodo, original };
    },
  );
  try {
    const [kpis, graficos] = await Promise.all([
      copiarVista(indicadores, limites),
      copiarComparativo(comparativo),
    ]);
    return { kpis: imagen(kpis, limites), graficos };
  } finally {
    for (const { nodo, original } of estilos) {
      if (original == null) nodo.removeAttribute("style");
      else nodo.setAttribute("style", original);
    }
  }
}
