import * as ui from "./components/controles.js";
import { confirmarCierreSesion } from "./components/dialogos.js";
import { montarMarcoAplicacion } from "./components/marco-aplicacion.js";
import navegacion from "./components/navegacion.js";
import { permisos } from "./state/permisos.js";
import { vales } from "./state/vales.js";
import formato from "./shared/formato.js";
import { rutas, tituloRuta } from "./router/rutas.js";
import { actualizarSesion } from "./service/sesion.js";
import { cerrarSesion } from "./api/sesion-api.js";
import { habilitarDetalleVales } from "./features/vales/detalle.js";
import mostrarAcceso from "./features/acceso/pagina.js";

const primeraRuta = () => permisos.current?.allow[0];
const puedeAbrir = ruta => Object.hasOwn(rutas, ruta) && permisos.can(ruta);

function mostrarRuta(fragmento) {
  const [solicitada, parametros] = fragmento.split("?", 2);
  const ruta = puedeAbrir(solicitada) ? solicitada : primeraRuta();
  if (!ruta) return;
  if (ruta !== solicitada) history.replaceState(null, "", "#" + ruta);
  const idQr = ruta === solicitada ? new URLSearchParams(parametros).get("vale") : null;
  const vale = idQr ? vales.all().find(v => v.id_qr === idQr && permisos.eligible(ruta, v)) : undefined;
  navegacion.active(ruta);
  rutas[ruta](vale);
  if (idQr && !vale) ui.toast("El vale ya no está disponible para esta operación.");
  document.title = tituloRuta(ruta) + " | Vales";
}

function navegar(ruta) {
  if (!puedeAbrir(ruta)) {
    ui.toast("Tu perfil no tiene acceso a este servicio.");
    return;
  }
  navegacion.close();
  if (location.hash === "#" + ruta) mostrarRuta(ruta);
  else location.hash = ruta;
}

async function cambiarRuta() {
  if (!permisos.current) return;
  const destino = location.hash;
  try {
    await actualizarSesion();
    if (destino === location.hash) mostrarRuta(destino.slice(1));
  } catch (error) {
    ui.toast(error.message);
  }
}

async function iniciar() {
  if (location.pathname === "/app/login") {
    mostrarAcceso();
    return;
  }
  const app = document.getElementById("app");
  app.innerHTML = '<p role="status" class="content">Cargando servicios…</p>';
  try {
    await actualizarSesion();
    montarMarcoAplicacion(app, permisos.current, {
      alCerrarSesion: () => confirmarCierreSesion(cerrarSesion).catch(error => ui.toast(error.message)),
    });
    if (primeraRuta()) mostrarRuta(location.hash.slice(1));
    else document.getElementById("view").textContent = "Tu cuenta aún no tiene servicios asignados.";
  } catch (error) {
    app.innerHTML = `<p role="alert" class="content">${formato.escape(error.message)}</p>`;
  }
}

document.addEventListener("click", evento => {
  const control = evento.target.closest("[data-route]");
  if (control) navegar(control.dataset.route);
});
window.addEventListener("hashchange", cambiarRuta);
habilitarDetalleVales();
iniciar();
