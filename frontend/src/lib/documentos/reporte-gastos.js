import QRCode from "qrcode";
import { date, money, qty } from "../api";
import { cargarDependenciasPdf } from "./dependencias-pdf";

const normalizar = (valor) =>
  String(valor ?? "")
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/[\u2010-\u2015]/g, "-");

export async function crearPdfDeGastos(reporte, vista, vales, origen) {
  await cargarDependenciasPdf();
  const { PDFDocument, PDFString, StandardFonts, rgb } = globalThis.PDFLib;
  const documento = await PDFDocument.create();
  documento.setTitle("Consultar gastos");
  documento.setCreator("Vales");
  documento.registerFontkit(globalThis.fontkit);
  const fuente = await documento.embedFont(globalThis.ValesPDFFontData, {
    subset: true,
  });
  const negrita = await documento.embedFont(StandardFonts.HelveticaBold);
  const tinta = rgb(0.094, 0.196, 0.294);
  const tenue = rgb(0.322, 0.404, 0.482);
  const principal = rgb(0.031, 0.498, 0.525);
  const borde = rgb(0.863, 0.89, 0.918);
  const fondo = rgb(0.949, 0.969, 0.976);
  const ancho = 595.28;
  const alto = 841.89;
  const margen = 30;
  const usable = ancho - margen * 2;
  const pie = 45;
  const puntos = [];
  const destinos = new Map();
  let pagina;
  let y;

  const medir = (valor, tam) =>
    fuente.widthOfTextAtSize(normalizar(valor), tam);
  const texto = (
    valor,
    x,
    pos,
    { tam = 10, color = tinta, font = fuente } = {},
  ) =>
    pagina.drawText(normalizar(valor), { x, y: pos, size: tam, font, color });
  const derecha = (valor, pos) =>
    texto(valor, ancho - margen - medir(valor, 10), pos, { color: tenue });
  const linea = (pos) =>
    pagina.drawLine({
      start: { x: margen, y: pos },
      end: { x: ancho - margen, y: pos },
      thickness: 0.6,
      color: borde,
    });

  function envolver(valor, espacio, tam) {
    return normalizar(valor)
      .split("\n")
      .flatMap((parrafo) => {
        const lineas = [];
        let actual = "";
        for (const palabra of parrafo.trim().split(/\s+/)) {
          const candidata = actual ? actual + " " + palabra : palabra;
          if (medir(candidata, tam) <= espacio) {
            actual = candidata;
            continue;
          }
          if (actual) lineas.push(actual);
          actual = "";
          for (const letra of palabra) {
            if (actual && medir(actual + letra, tam) > espacio) {
              lineas.push(actual);
              actual = "";
            }
            actual += letra;
          }
        }
        return [...lineas, actual];
      });
  }

  function nuevaPagina() {
    pagina = documento.addPage([ancho, alto]);
    texto("Consultar gastos", margen, alto - 44, { tam: 18, font: negrita });
    texto("Control de combustible", margen, alto - 60, { color: tenue });
    derecha(reporte.periodo, alto - 47);
    linea(alto - 75);
    y = alto - 91;
  }

  function enlace(origenPagina, rect, accion) {
    const referencia = documento.context.register(
      documento.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: rect,
        Border: [0, 0, 0],
        ...accion,
      }),
    );
    origenPagina.node.addAnnot(referencia);
  }

  async function dibujarVista(imagen, escala) {
    const superior = y;
    const base = superior - imagen.alto * escala;
    pagina.drawImage(await documento.embedPng(imagen.png), {
      x: margen,
      y: base,
      width: imagen.ancho * escala,
      height: imagen.alto * escala,
    });
    for (const punto of imagen.puntos ?? []) {
      puntos.push({
        pagina,
        periodo: punto.periodo,
        x: margen + punto.x * escala,
        y: superior - punto.y * escala,
      });
    }
    y = base;
  }

  function tabla(titulo, columnas, subtitulo = "", continuar = false) {
    const anchos = columnas.map(([, fraccion]) => fraccion * usable);
    const posiciones = anchos.map(
      (_, i) => margen + anchos.slice(0, i).reduce((a, b) => a + b, 0),
    );
    const relleno = 7;
    const tam = 9.25;
    const interlineado = 12;

    function cabecera(enPaginaActual = false) {
      if (enPaginaActual) y -= 26;
      else nuevaPagina();
      texto(titulo, margen, y - 4, { tam: 14, font: negrita });
      y -= 20;
      if (subtitulo) {
        envolver(subtitulo, usable, 10).forEach((parte) => {
          texto(parte, margen, y, { color: tenue });
          y -= 14;
        });
      }
      pagina.drawRectangle({
        x: margen,
        y: y - 25,
        width: usable,
        height: 25,
        color: fondo,
      });
      columnas.forEach(([nombre], i) =>
        texto(nombre, posiciones[i] + relleno, y - 16, { tam, font: negrita }),
      );
      y -= 25;
    }

    cabecera(continuar && y - pie >= 150);
    return (celdas, { qr, url, periodo } = {}) => {
      const bloques = celdas.map((celda, i) =>
        envolver(celda, anchos[i] - 2 * relleno, tam),
      );
      const lineas = Math.max(...bloques.map((bloque) => bloque.length));
      const altura = Math.max(lineas * interlineado + 2 * relleno, qr ? 64 : 0);
      if (y - altura < pie) cabecera();
      if (periodo) destinos.set(periodo, { pagina, y: y + 7 });
      bloques.forEach((bloque, i) => {
        const superior = y - (altura - bloque.length * interlineado) / 2 - tam;
        bloque.forEach((valor, j) =>
          texto(valor, posiciones[i] + relleno, superior - j * interlineado, {
            tam,
            color: url && i === 0 ? principal : tinta,
          }),
        );
      });
      if (qr) {
        pagina.drawImage(qr, {
          x: posiciones.at(-1) + (anchos.at(-1) - 54) / 2,
          y: y - (altura + 54) / 2,
          width: 54,
          height: 54,
        });
      }
      if (url) {
        enlace(pagina, [margen, y - altura, ancho - margen, y], {
          A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
        });
      }
      y -= altura;
      linea(y);
    };
  }

  nuevaPagina();
  if (reporte.filtros.length) {
    const filtros = reporte.filtros.map(
      ({ etiqueta, valor }) => etiqueta + " " + valor,
    );
    envolver(filtros.join(" / "), usable, 10).forEach((filtro) => {
      texto(filtro, margen, y, { color: tenue });
      y -= 14;
    });
    y -= 8;
  }
  const primero = vista.graficos[0];
  const separacion = 14;
  const escala = Math.min(
    usable / Math.max(vista.kpis.ancho, primero.ancho),
    (y - pie - separacion) / (vista.kpis.alto + primero.alto),
  );
  await dibujarVista(vista.kpis, escala);
  y -= separacion;
  await dibujarVista(primero, escala);
  for (const grafico of vista.graficos.slice(1)) {
    nuevaPagina();
    await dibujarVista(
      grafico,
      Math.min(usable / grafico.ancho, (y - pie) / grafico.alto),
    );
  }

  const seleccion = reporte.detalle.seleccion;
  const cantidad = vales.length + (vales.length === 1 ? " vale" : " vales");
  const subtitulo = seleccion
    ? cantidad + " de " + seleccion.combustible + " en " + seleccion.periodo
    : cantidad;
  const filaVale = tabla(
    "Vales facturados",
    [
      ["Vale", 0.14],
      ["Combustible", 0.18],
      ["Cantidad", 0.105],
      ["Precio/gal", 0.145],
      ["Factura", 0.16],
      ["Fecha", 0.15],
      ["QR", 0.12],
    ],
    subtitulo,
    true,
  );
  if (!vales.length) {
    texto("No hay vales facturados en la consulta.", margen + 7, y - 20, {
      color: tenue,
    });
  }
  for (const vale of vales) {
    const verificacion = new URL(
      "/vales/q/" + encodeURIComponent(vale.id_qr),
      origen,
    );
    const pdf = new URL(verificacion);
    pdf.pathname += "/documento";
    pdf.searchParams.set("formato", "pdf");
    const qr = await documento.embedPng(
      await QRCode.toDataURL(verificacion.href, {
        width: 240,
        margin: 4,
        errorCorrectionLevel: "M",
      }),
    );
    filaVale(
      [
        vale.codigo_vale,
        vale.suministro,
        qty(vale.cantidad_consumida) + " gal",
        vale.precio_real == null ? "-" : money(vale.precio_real),
        vale.factura_numero,
        date(vale.fecha_consumo),
        "",
      ],
      { qr, url: pdf.href },
    );
  }

  if (reporte.periodos.length) {
    const filaPeriodo = tabla("Valores del comparativo", [
      ["Período", 0.31],
      ["Combustible", 0.25],
      ["Importe", 0.17],
      ["Galones", 0.16],
      ["Vales", 0.11],
    ]);
    for (const periodo of reporte.periodos) {
      periodo.valores.forEach(
        ({ nombre, importe, galones, vales: atendidos }, i) =>
          filaPeriodo(
            [periodo.nombre, nombre, money(importe), qty(galones), atendidos],
            { periodo: i === 0 ? periodo.inicio : undefined },
          ),
      );
    }
  }

  for (const punto of puntos) {
    const destino = destinos.get(punto.periodo);
    if (destino) {
      enlace(
        punto.pagina,
        [punto.x - 7, punto.y - 7, punto.x + 7, punto.y + 7],
        {
          Dest: [destino.pagina.ref, "XYZ", null, destino.y, null],
        },
      );
    }
  }
  const paginas = documento.getPages();
  paginas.forEach((paginaReporte, i) => {
    pagina = paginaReporte;
    linea(38);
    texto("Vales", margen, 24, { tam: 9, color: tenue });
    derecha("Página " + (i + 1) + " de " + paginas.length, 24);
  });
  return new Blob([new Uint8Array(await documento.save())], {
    type: "application/pdf",
  });
}
