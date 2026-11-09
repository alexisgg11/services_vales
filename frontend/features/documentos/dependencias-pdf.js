const scripts = new Map();

function cargarScript(archivo) {
  if (!scripts.has(archivo)) {
    const carga = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/app/vendor/" + archivo;
      script.onload = resolve;
      script.onerror = () => {
        script.remove();
        reject(new Error("Vuelve a abrir el PDF para reintentar."));
      };
      document.head.append(script);
    }).catch(error => {
      scripts.delete(archivo);
      throw error;
    });
    scripts.set(archivo, carga);
  }
  return scripts.get(archivo);
}

export function cargarDependenciasPdf() {
  return Promise.all([
    "qrcode.js", "pdf-lib.min.js", "fontkit.umd.min.js", "selawik-regular.js",
    "pdf.worker.js", "pdf.js",
  ].map(cargarScript));
}
