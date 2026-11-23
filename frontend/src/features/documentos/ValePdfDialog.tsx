import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, Printer, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Busy, ErrorText } from "@/components/ui/feedback";
import { useData, detalleValeConsulta } from "@/lib/consultas";

import type { Vale } from "@/lib/types";

const PdfPreview = lazy(() => import("./PdfPreview"));

export default function ValePdfDialog({
  vale,
  onClose,
}: {
  vale: Vale;
  onClose: () => void;
}) {
  const latest = useQuery({
    ...detalleValeConsulta(vale.id_qr),
    refetchOnWindowFocus: false,
    retry: false,
  });
  const { data } = useData();
  const actual = latest.data?.vale || vale;
  const base = data?.publicBaseUrl || location.origin;
  const [pdf, setPdf] = useState<{
      datos: Uint8Array<ArrayBuffer>;
      url: string;
    }>(),
    [error, setError] = useState<unknown>(),
    [intento, setIntento] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const [impresion, setImpresion] = useState<{
    url: string;
    estado: "lista" | "alternativa";
  }>();
  const visorNativo = navigator.pdfViewerEnabled !== false;
  useEffect(() => {
    setPdf(undefined);
    if (!latest.data || latest.isFetching || latest.error) return;
    let activo = true,
      url: string | undefined;
    setError(undefined);
    async function generar() {
      try {
        const [
          { cargarDependenciasPdf },
          { renderizarPdf },
          { modeloPdf },
          { mapearVale },
        ] = await Promise.all([
          import("@/lib/documentos/dependencias-pdf.js"),
          import("@/lib/documentos/composicion-pdf.js"),
          import("@/lib/documentos/modelo-pdf.js"),
          import("@/lib/mapear-vale.js"),
        ]);
        await cargarDependenciasPdf();
        if (!activo) return;
        const v = latest.data!.vale;
        const mapped = mapearVale(v);
        const bytes = await renderizarPdf(
          modeloPdf(mapped),
          mapped,
          base + "/vales/q/" + v.id_qr,
        );
        if (!activo) return;
        const datos = new Uint8Array(bytes);
        url = URL.createObjectURL(
          new Blob([datos], { type: "application/pdf" }),
        );
        setPdf({ datos, url });
      } catch (e) {
        if (activo) setError(e);
      }
    }
    void generar();
    return () => {
      activo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [latest.data, latest.isFetching, latest.error, base, intento]);
  const fallo = latest.error || error;
  const documento = pdf && !latest.isFetching && !fallo ? pdf : undefined;
  const estadoImpresion =
    impresion?.url === documento?.url ? impresion?.estado : undefined;
  const urlDocumento = documento?.url;

  useEffect(() => {
    if (!urlDocumento || !visorNativo || estadoImpresion) return;
    const espera = window.setTimeout(
      () => setImpresion({ url: urlDocumento, estado: "alternativa" }),
      6000,
    );
    return () => window.clearTimeout(espera);
  }, [urlDocumento, visorNativo, estadoImpresion]);

  function comprobarImpresion(url: string, marco: HTMLIFrameElement) {
    try {
      if (typeof marco.contentWindow?.print === "function") {
        setImpresion({ url, estado: "lista" });
        return;
      }
    } catch {
      // El visor nativo puede impedir el acceso a su ventana.
    }
    setImpresion({ url, estado: "alternativa" });
  }

  function imprimir() {
    if (!urlDocumento || estadoImpresion !== "lista") return;
    try {
      const ventana = frame.current?.contentWindow;
      if (ventana && typeof ventana.print === "function") {
        ventana.focus();
        ventana.print();
        return;
      }
    } catch {
      // La acción Abrir PDF permite imprimir desde el visor del navegador.
    }
    setImpresion({ url: urlDocumento, estado: "alternativa" });
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="pdf-document-dialog">
        <DialogHeader className="pdf-document-header">
          <DialogTitle>
            PDF del vale {actual.codigo_vale} ({actual.zonal})
          </DialogTitle>
          <DialogDescription className="sr-only">
            Vista previa del vale de combustible
          </DialogDescription>
        </DialogHeader>
        <div className="pdf-document-body" data-vista={!!documento}>
          <ErrorText error={fallo} />
          {fallo ? (
            <Button
              variant="outline"
              onClick={() =>
                latest.error ? void latest.refetch() : setIntento((n) => n + 1)
              }
            >
              <RefreshCw /> Reintentar PDF
            </Button>
          ) : documento ? (
            <Suspense fallback={<Busy />}>
              <PdfPreview datos={documento.datos} />
            </Suspense>
          ) : (
            <Busy />
          )}
          {documento && visorNativo && (
            <iframe
              key={documento.url}
              ref={frame}
              className="pdf-print-frame"
              src={documento.url}
              tabIndex={-1}
              aria-hidden="true"
              title={"PDF para imprimir del vale " + actual.codigo_vale}
              onLoad={(evento) =>
                comprobarImpresion(documento.url, evento.currentTarget)
              }
              onError={() =>
                setImpresion({ url: documento.url, estado: "alternativa" })
              }
            />
          )}
        </div>
        <footer className="pdf-document-footer">
          {documento && (
            <div className="pdf-document-actions">
              <Button asChild>
                <a
                  href={documento.url}
                  download={
                    "Vale-" + actual.zonal + "-" + actual.codigo_vale + ".pdf"
                  }
                >
                  <Download aria-hidden="true" /> Descargar PDF
                </a>
              </Button>
              {visorNativo && (
                <Button
                  variant="outline"
                  disabled={estadoImpresion !== "lista"}
                  onClick={imprimir}
                  title={estadoImpresion ? undefined : "Preparando impresión"}
                >
                  <Printer aria-hidden="true" /> Imprimir
                </Button>
              )}
              <Button asChild variant="outline">
                <a
                  href={documento.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink aria-hidden="true" /> Abrir PDF
                </a>
              </Button>
            </div>
          )}
          <Button
            className="pdf-document-close"
            variant="outline"
            onClick={onClose}
          >
            Cerrar PDF
          </Button>
          {documento && visorNativo && estadoImpresion === "alternativa" && (
            <p className="pdf-impresion-aviso" role="status">
              Usa Abrir PDF para imprimir desde el navegador.
            </p>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
