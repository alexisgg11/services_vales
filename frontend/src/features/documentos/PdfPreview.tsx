import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { PDFDocumentLoadingTask } from "pdfjs-dist";
import type { PDFViewer } from "pdfjs-dist/legacy/web/pdf_viewer.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import "pdfjs-dist/legacy/web/pdf_viewer.css";
import { Button } from "@/components/ui/button";

const escalaMinima = 0.1;
const escalaMaxima = 3;
const pasoZoom = 1.25;
const pixelesMaximos = 8_000_000;

function cambiarZoom(
  visor: PDFViewer,
  factor: number,
  origen?: [number, number],
  desplazamiento?: [number, number],
) {
  const actual = visor.currentScale;
  const siguiente = Math.min(
    escalaMaxima,
    Math.max(escalaMinima, actual * factor),
  );
  if (actual === siguiente) {
    if (desplazamiento) visor.panBy(...desplazamiento);
    return;
  }
  visor.updateScale({
    scaleFactor: siguiente / actual,
    drawingDelay: origen ? 100 : undefined,
    origin: origen,
    pan: desplazamiento,
  });
}

export default function PdfPreview({ datos }: { datos: Uint8Array }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const paginas = useRef<HTMLDivElement>(null);
  const visor = useRef<PDFViewer | null>(null);
  const [escala, setEscala] = useState(1);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">(
    "cargando",
  );
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    const ventana = contenedor.current;
    const documento = paginas.current;
    if (!ventana || !documento) return;

    const control = new AbortController();
    const { signal } = control;
    let carga: PDFDocumentLoadingTask | undefined;
    let dimensiones: ResizeObserver | undefined;
    let actual: PDFViewer | undefined;
    setEstado("cargando");
    setPagina(1);
    setTotal(0);

    async function cargar(ventana: HTMLDivElement, documento: HTMLDivElement) {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        if (signal.aborted) return;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const { EventBus, PDFViewer } =
          await import("pdfjs-dist/legacy/web/pdf_viewer.mjs");
        if (signal.aborted) return;

        const eventos = new EventBus();
        const opcionesVisor = {
          container: ventana,
          viewer: documento,
          eventBus: eventos,
          annotationMode: pdfjs.AnnotationMode.DISABLE,
          enableAutoLinking: false,
          removePageBorders: true,
          maxCanvasPixels: pixelesMaximos,
          abortSignal: signal,
        };
        const vista = new PDFViewer(opcionesVisor);
        actual = vista;
        visor.current = vista;
        eventos.on(
          "pagesinit",
          () => {
            setTotal(vista.pagesCount);
            vista.currentScaleValue = "page-width";
            dimensiones = new ResizeObserver(() => {
              const modo = vista.currentScaleValue;
              if (modo === "page-width" || modo === "page-fit") {
                vista.currentScaleValue = modo;
              }
            });
            dimensiones.observe(ventana);
          },
          { signal },
        );
        eventos.on(
          "pagechanging",
          ({ pageNumber }: { pageNumber: number }) => setPagina(pageNumber),
          { signal },
        );
        eventos.on(
          "scalechanging",
          ({ scale }: { scale: number }) => setEscala(scale),
          { signal },
        );
        eventos.on(
          "pagerendered",
          ({ error }: { error?: unknown }) =>
            setEstado(error ? "error" : "listo"),
          { signal },
        );

        new pdfjs.TouchManager({
          container: ventana,
          signal,
          isPinchingDisabled: () => !vista.pagesCount,
          onPanning: (dx: number, dy: number) => vista.panBy(dx, dy),
          onPinching: (
            [x, y]: [number, number],
            distanciaAnterior: number,
            distancia: number,
            dx: number,
            dy: number,
          ) => {
            const rect = ventana.getBoundingClientRect();
            cambiarZoom(
              vista,
              distancia / distanciaAnterior,
              [
                x - rect.left + ventana.offsetLeft,
                y - rect.top + ventana.offsetTop,
              ],
              [dx, dy],
            );
          },
        });

        carga = pdfjs.getDocument({ data: datos.slice() });
        const archivo = await carga.promise;
        if (!signal.aborted) vista.setDocument(archivo);
      } catch {
        if (!signal.aborted) setEstado("error");
      }
    }

    void cargar(ventana, documento);
    return () => {
      dimensiones?.disconnect();
      actual?.setDocument(null);
      control.abort();
      visor.current = null;
      void carga?.destroy().catch(() => {});
    };
  }, [datos, intento]);

  const listo = estado === "listo";
  function verPaginaCompleta() {
    const vista = visor.current;
    if (!vista) return;
    vista.currentScaleValue = "page-fit";
    vista.scrollPageIntoView({ pageNumber: vista.currentPageNumber });
  }

  return (
    <div className="pdf-viewer">
      <div className="pdf-controls" role="group" aria-label="Controles del PDF">
        <div className="pdf-zoom" role="group" aria-label="Zoom del PDF">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Alejar PDF"
            title="Alejar PDF"
            disabled={!listo || escala <= escalaMinima}
            onClick={() =>
              visor.current && cambiarZoom(visor.current, 1 / pasoZoom)
            }
          >
            <Minus aria-hidden="true" />
          </Button>
          <output aria-live="polite">
            {listo ? Math.round(escala * 100) + "%" : "—"}
          </output>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Ampliar PDF"
            title="Ampliar PDF"
            disabled={!listo || escala >= escalaMaxima}
            onClick={() =>
              visor.current && cambiarZoom(visor.current, pasoZoom)
            }
          >
            <Plus aria-hidden="true" />
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!listo}
          onClick={verPaginaCompleta}
        >
          Página completa
        </Button>
        {total > 1 && (
          <output className="pdf-numero-pagina" aria-live="polite">
            Página {pagina} de {total}
          </output>
        )}
      </div>
      <div className="pdf-viewport">
        <div
          ref={contenedor}
          className="pdf-pages"
          role="region"
          aria-label="Vista previa del PDF comparativo"
          tabIndex={0}
        >
          <div className="pdfViewer" ref={paginas} />
        </div>
        {estado === "cargando" && (
          <p className="pdf-estado" role="status">
            Preparando páginas del PDF
          </p>
        )}
        {estado === "error" && (
          <div className="pdf-estado stack">
            <p className="error" role="alert">
              No se pudo mostrar la vista previa. Reintenta o descarga el PDF.
            </p>
            <Button variant="outline" onClick={() => setIntento((n) => n + 1)}>
              Reintentar vista previa
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
