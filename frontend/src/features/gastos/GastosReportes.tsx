import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { FileSpreadsheet, FileText, LoaderCircle } from "lucide-react";
import { ErrorText } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  descargarArchivo,
  prepararReporteGastos,
  type DatosReporteGastos,
} from "./gastos-exportacion";

const formatos = [
  { extension: "xlsx", nombre: "Excel", Icono: FileSpreadsheet },
  { extension: "pdf", nombre: "PDF", Icono: FileText },
] as const;

type Formato = (typeof formatos)[number]["extension"];

export function GastosReportes({
  datos,
  elementos,
  origen,
}: {
  datos: DatosReporteGastos;
  elementos: {
    indicadores: RefObject<HTMLDListElement | null>;
    comparativo: RefObject<HTMLElement | null>;
  };
  origen: string;
}) {
  const [generando, setGenerando] = useState<Formato>();
  const [error, setError] = useState("");
  const consultaVigente = useRef<DatosReporteGastos | null>(datos);
  useLayoutEffect(() => {
    consultaVigente.current = datos;
    return () => {
      consultaVigente.current = null;
    };
  }, [datos]);

  async function generarPdf(reporte: ReturnType<typeof prepararReporteGastos>) {
    const [{ capturarGastos }, { crearPdfDeGastos }] = await Promise.all([
      import("./captura-gastos"),
      import("@/lib/documentos/reporte-gastos.js"),
    ]);
    const { indicadores, comparativo } = elementos;
    if (
      !indicadores.current ||
      !comparativo.current ||
      consultaVigente.current !== datos
    ) {
      throw new Error("La consulta cambió durante la exportación.");
    }
    const vista = await capturarGastos(
      indicadores.current,
      comparativo.current,
    );
    if (consultaVigente.current !== datos)
      throw new Error("La consulta cambió durante la exportación.");
    return await crearPdfDeGastos(reporte, vista, datos.vales, origen);
  }

  async function descargar(extension: Formato) {
    setGenerando(extension);
    setError("");
    try {
      const reporte = prepararReporteGastos(datos);
      const archivo =
        extension === "xlsx"
          ? await (
              await import("./reporte-excel")
            ).crearExcelGastos(reporte, datos.vales, origen)
          : await generarPdf(reporte);
      descargarArchivo(
        archivo,
        `Gastos-${reporte.desde}-${reporte.hasta}.${extension}`,
      );
    } catch {
      setError("No se pudo generar el reporte. Inténtalo de nuevo.");
    } finally {
      setGenerando(undefined);
    }
  }

  return (
    <div className="gastos-reportes" aria-busy={!!generando}>
      <div
        className="gastos-reportes-botones"
        role="group"
        aria-label="Reportes de gastos"
      >
        {formatos.map(({ extension, nombre, Icono }) => (
          <Button
            key={extension}
            type="button"
            variant="outline"
            disabled={!!generando}
            aria-label={"Descargar reporte de gastos en " + nombre}
            onClick={() => descargar(extension)}
          >
            {generando === extension ? (
              <LoaderCircle className="spin" aria-hidden="true" />
            ) : (
              <Icono aria-hidden="true" />
            )}
            {nombre}
          </Button>
        ))}
      </div>
      <ErrorText error={error} />
    </div>
  );
}
