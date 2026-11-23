import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";

const marcaRecursos = "/* recursos de Vite */ []";

export function prepararPwa(): Plugin {
  let config: ResolvedConfig;
  return {
    name: "vales-pwa",
    apply: "build",
    configResolved(resuelta) {
      config = resuelta;
    },
    closeBundle() {
      const salida = resolve(config.root, config.build.outDir);
      const archivo = join(salida, "sw.js");
      const worker = readFileSync(archivo, "utf8");
      if (!worker.includes(marcaRecursos))
        throw new Error("Falta la marca de recursos de Vite en sw.js.");

      const recursos = readdirSync(join(salida, config.build.assetsDir))
        .filter((nombre) => /\.(m?js|css)$/.test(nombre))
        .sort()
        .map((nombre) => config.base + config.build.assetsDir + "/" + nombre);
      const version = createHash("sha256")
        .update(worker)
        .update(JSON.stringify(recursos))
        .update(readFileSync(join(salida, "index.html")))
        .update(readFileSync(join(salida, "pwa/manifest.webmanifest")))
        .update(readFileSync(join(salida, "pwa/icon.svg")))
        .digest("hex")
        .slice(0, 16);
      writeFileSync(
        archivo,
        worker
          .replace("__VALES_VERSION__", version)
          .replace(marcaRecursos, JSON.stringify(recursos)),
      );
    },
  };
}
