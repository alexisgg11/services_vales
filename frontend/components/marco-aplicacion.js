import { icon, icons } from "./controles.js";
import navegacion from "./navegacion.js";

export function montarMarcoAplicacion(host, usuario, { alCerrarSesion }) {
  host.innerHTML = `<div class="workspace">
    ${navegacion.desktop(usuario)}
    <div class="workspace-main">
      <header class="workspace-topbar">
        <button type="button" class="icon-btn menu-toggle" id="open-services" aria-label="Abrir menú de servicios">${icon("menu")}</button>
        <span class="workspace-caption">Control de combustible</span>
        <div class="workspace-actions">
          <button type="button" class="icon-btn" id="logout" aria-label="Cerrar sesión" title="Cerrar sesión">${icon("log-out")}</button>
        </div>
      </header>
      <main class="content" id="view" tabindex="-1"></main>
    </div>
  </div>`;
  navegacion.activarPerfil(host, alCerrarSesion);
  host.querySelector("#logout").addEventListener("click", alCerrarSesion);
  host.querySelector("#open-services").addEventListener("click", () => navegacion.toggle(usuario, alCerrarSesion));
  navegacion.update();
  icons();
}
