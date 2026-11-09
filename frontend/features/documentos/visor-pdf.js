import * as ui from "../../components/controles.js";
import { sheet } from "../../components/dialogos.js";
import formato from "../../shared/formato.js";
import documento from "./modelo-pdf.js";

export const vistaPreviaPdf =
  '<div class="pdf-loading" role="status">Preparando documento…</div><div class="pdf-pages" aria-label="Vista previa del PDF"></div>';

export function accionesPdf({ soloIconos = false } = {}) {
  if (soloIconos) return ui.iconAction("Imprimir", "printer", 'id="print-vale" disabled') +
    ui.iconAction("Descargar PDF", "download", 'id="download-vale" disabled');
  return ui.button("Imprimir", { id: "print-vale", icon: "printer", disabled: true }) +
    ui.button("Descargar PDF", { id: "download-vale", icon: "download", variant: "primary", disabled: true });
}

export function montarVisorPdf(root, vale, preparar) {
  const host = root.querySelector(".pdf-pages");
  const carga = root.querySelector(".pdf-loading");
  const printHost = document.getElementById("print-document");
  let cerrado = false, documentoPdf, tarea, url;

  async function mostrar() {
    try {
      const resultado = await preparar();
      if (cerrado) return;
      url = URL.createObjectURL(new Blob([resultado.bytes], { type: "application/pdf" }));
      documentoPdf = pdfjsLib.getDocument({
        data: resultado.bytes.slice(),
        useSystemFonts: true,
        isEvalSupported: false,
      });
      const pdf = await documentoPdf.promise;
      for (let i = 1; i <= pdf.numPages && !cerrado; i++) {
        const pagina = await pdf.getPage(i);
        if (cerrado) return;
        const base = pagina.getViewport({ scale: 1 });
        const viewport = pagina.getViewport({ scale: 1600 / base.width });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = "100%";
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", "Vale " + formato.reference(vale) + ", página " + i + " de " + pdf.numPages);
        canvas.dataset.pdfPage = i;
        host.append(canvas);
        tarea = pagina.render({ canvasContext: canvas.getContext("2d"), viewport });
        await tarea.promise;
      }
      if (cerrado) return;
      carga.remove();
      const accesible = document.createElement("div");
      accesible.className = "sr-only";
      accesible.textContent = JSON.stringify(resultado.model);
      host.append(accesible);
      habilitarAcciones();
    } catch (error) {
      if (!cerrado) carga.textContent = "No se pudo preparar el documento. " + error.message;
    }
  }

  function habilitarAcciones() {
    const imprimir = root.querySelector("#print-vale");
    imprimir.disabled = false;
    imprimir.addEventListener("click", imprimirPdf);

    const original = root.querySelector("#download-vale");
    const descargar = document.createElement("a");
    for (const atributo of original.attributes) {
      if (atributo.name !== "type" && atributo.name !== "disabled")
        descargar.setAttribute(atributo.name, atributo.value);
    }
    descargar.innerHTML = original.innerHTML;
    descargar.href = url;
    descargar.download = "vale-" + formato.code(vale) + "-" + vale.zone.toLowerCase() + ".pdf";
    original.replaceWith(descargar);
  }

  async function imprimirPdf() {
    printHost.replaceChildren();
    host.querySelectorAll("canvas").forEach(canvas => {
      const imagen = document.createElement("img");
      imagen.src = canvas.toDataURL("image/png");
      imagen.className = "pdf-print-page";
      imagen.alt = "Vale " + formato.reference(vale);
      printHost.append(imagen);
    });
    await Promise.all([...printHost.querySelectorAll("img")].map(imagen => imagen.decode()));
    if (cerrado) return;
    window.addEventListener("afterprint", () => printHost.replaceChildren(), { once: true });
    window.print();
  }

  mostrar();
  return () => {
    cerrado = true;
    tarea?.cancel();
    documentoPdf?.destroy();
    if (url) URL.revokeObjectURL(url);
    printHost.replaceChildren();
  };
}

function open(vale) {
  let limpiar;
  const modal = sheet({
    title: "PDF del vale",
    subtitle: formato.reference(vale),
    centered: true,
    content: vistaPreviaPdf,
    footer: ui.button("Cerrar", { attrs: "data-close" }) + accionesPdf(),
    onClose: () => limpiar?.(),
  });
  modal.root.classList.add("pdf-dialog");
  limpiar = montarVisorPdf(modal.root, vale, () => documento.create(vale));
  return modal;
}

export default { open };
