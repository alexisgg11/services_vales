import { beforeAll, it, expect, vi } from "vitest";
import fs from "node:fs";
import vm from "node:vm";
import { renderizarPdf } from "./composicion-pdf.js";
import { modeloPdf } from "./modelo-pdf.js";
import { mapearVale } from "../mapear-vale.js";

beforeAll(() => {
  for (const file of [
    "pdf-lib.min.js",
    "fontkit.umd.min.js",
    "selawik-regular.js",
    "lucide.min.js",
  ])
    vm.runInThisContext(
      fs.readFileSync(
        new URL("../../../public/documentos/vendor/" + file, import.meta.url),
        "utf8",
      ),
    );
});

const vale = mapearVale({
  id_vale: "1",
  id_qr: "12345678-1234-1234-1234-123456789012",
  codigo_vale: "2026110001",
  cod_zonal: "01",
  zonal: "PIURA",
  localidad: "CASTILLA",
  cod_proveedor: "20000000001",
  grifo: "Grifo Los Algarrobos (demo)",
  suministro: "Gasolina premium",
  id_suministro: "GP",
  trabajador: "Rosa Gutiérrez",
  dni_trabajador: "90000001",
  unidad_organizativa: "GERENCIA DE OPERACIONES",
  centro_costo: "POZO LOS ALGARROBOS",
  localidad_centro: "PIURA",
  referencia_ubicacion_centro: "POZO LOS ALGARROBOS PIURA",
  placa: "DEM-101",
  zonal_base_unidad: "PIURA",
  nrocontrato: "DEMO-A",
  fecha_emision: "2026-11-21",
  fecha_consumo: "2026-11-21",
  cantidad_emitida: 2,
  precio_referencial: 24.4,
  cantidad_consumida: 1.25,
  precio_real: 24.4,
  importe: 30.5,
  estado_vale: 3,
  ticket: "T00000000000026",
  factura_numero: "F001-00000103",
  observacion: "Prueba del documento comparativo.",
  responsables: [
    {
      accion: "EMISION",
      nombre: "Rosa Gutiérrez",
      cargo: "Operativo",
      fecha: "2026-11-21T05:00:00Z",
    },
    {
      accion: "AUTORIZACION",
      nombre: "Carlos Medina",
      cargo: "Jefe zonal",
      fecha: "2026-11-21T05:02:00Z",
    },
    {
      accion: "ATENCION",
      nombre: "Lucía Torres",
      cargo: "Atención del grifo",
      fecha: "2026-11-21T05:04:00Z",
    },
  ],
});

it("conserva el comparativo, DNI, QR y responsables en una página de un vale atendido normal", async () => {
  const model = modeloPdf(vale);
  expect(model.info).toContainEqual(["DNI del trabajador", "90000001"]);
  expect(model.comparison).toHaveLength(2);
  const bytes = await renderizarPdf(
      model,
      vale,
      "https://vales.example/vales/q/" + vale.id_qr,
    ),
    doc = await PDFLib.PDFDocument.load(bytes);
  expect(doc.getPageCount()).toBe(1);
  const modeloSinReferencia = modeloPdf({
    ...vale,
    centerLocationReference: undefined,
  });
  const bytesSinReferencia = await renderizarPdf(
    modeloSinReferencia,
    vale,
    "https://vales.example/vales/q/" + vale.id_qr,
  );
  expect(
    (await PDFLib.PDFDocument.load(bytesSinReferencia)).getPageCount(),
  ).toBe(1);
  expect(doc.getTitle()).toBe("Vale 2026110001 (PIURA)");
});

it("continúa la observación junto al QR y numera todas las hojas", async () => {
  const note =
    "Revisión de válvulas, lectura del medidor y control de presión en el centro de costo. "
      .repeat(14)
      .slice(0, 1000)
      .trim();
  const dibujarTexto = vi.spyOn(PDFLib.PDFPage.prototype, "drawText");
  try {
    const bytes = await renderizarPdf(
      modeloPdf({ ...vale, note }),
      vale,
      "https://vales.example/vales/q/" + vale.id_qr,
    );
    const documento = await PDFLib.PDFDocument.load(bytes);
    expect(documento.getPageCount()).toBe(2);
    const textos = dibujarTexto.mock.calls.map(([texto]) => texto);
    expect(textos).toContain("Página 1 de 2");
    const ultima = dibujarTexto.mock.contexts[textos.indexOf("Página 2 de 2")];
    expect(ultima).toBeDefined();
    const textosUltima = textos.filter(
      (_, index) => dibujarTexto.mock.contexts[index] === ultima,
    );
    expect(textosUltima).toContain("Observación (continuación)");
    expect(textosUltima).toContain("Escanea para consultar el vale");
    expect(
      dibujarTexto.mock.calls
        .filter(([, opciones]) => opciones.size === 10)
        .map(([texto]) => texto)
        .join(" "),
    ).toBe(note);
  } finally {
    dibujarTexto.mockRestore();
  }
});
