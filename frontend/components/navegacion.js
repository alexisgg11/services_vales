import * as U from "./controles.js";
import F from "../shared/formato.js";
import { permisos as P } from "../state/permisos.js";
import { servicios } from "../router/servicios.js";

export default (() => {
  const e = F.escape;
  let rutaActiva;
  let drawer = null,
    collapsed = false;
  try {
    collapsed = localStorage.getItem("vales.sidebar.collapsed") === "true";
  } catch {}
  const desktopMode = matchMedia("(min-width: 951px)");
  const links = () =>
    `<nav class="service-nav" aria-label="Servicios">${servicios.filter(
      (s) => P.can(s.id),
    )
      .map(
        (s) =>
          `<button type="button" data-route="${s.id}" aria-label="${e(s.label)}" title="${e(s.label)}">${U.icon(s.icon)}<span>${e(s.label)}</span></button>`,
      )
      .join("")}</nav>`;
  const perfil = (usuario) => {
    const resumen = usuario.roles.flatMap(rol => [rol.label, rol.provider || rol.zone].filter(Boolean));
    const roles = usuario.roles.map(rol => {
      const ambito = rol.provider || rol.zone;
      return `<span class="sidebar-profile-role">
        <small>${e(rol.label)}</small>
        ${ambito ? `<small class="sidebar-profile-scope">${U.icon(rol.provider ? "fuel" : "map-pin")}<span>${e(ambito)}</span></small>` : ""}
      </span>`;
    }).join("");
    return `<footer class="sidebar-footer">
    <details class="sidebar-profile">
      <summary aria-label="Opciones de cuenta de ${e(usuario.name)}" aria-description="${e(resumen.join(", "))}"
        title="${e([usuario.name, ...resumen].join("\n"))}">
        <span class="avatar" aria-hidden="true">${e(usuario.initials)}</span>
        <span class="sidebar-profile-name"><strong>${e(usuario.name)}</strong>${roles}</span>
        ${U.icon("chevrons-up-down")}
      </summary>
      <div class="sidebar-profile-actions">
        ${P.can("administracion") ? U.button("Configuración", { icon: "settings", variant: "ghost", attrs: 'data-route="administracion"' }) : ""}
        ${U.button("Cerrar sesión", { icon: "log-out", variant: "ghost", attrs: "data-cerrar-sesion" })}
      </div>
    </details>
  </footer>`;
  };
  const desktop = (usuario) =>
    `<aside class="app-sidebar" id="sidebar-services"><div class="sidebar-brand">${U.brand()}</div>${links()}${perfil(usuario)}</aside>`;
  const activarPerfil = (host, alCerrarSesion) => {
    const menu = host.querySelector(".sidebar-profile");
    const control = menu.querySelector("summary");
    const cerrarMenu = () => {
      menu.open = false;
      control.focus();
    };
    menu.querySelector("[data-cerrar-sesion]").addEventListener("click", () => {
      cerrarMenu();
      alCerrarSesion();
    });
    menu.querySelector('[data-route="administracion"]')?.addEventListener("click", cerrarMenu);
    menu.addEventListener("keydown", evento => {
      if (evento.key !== "Escape" || !menu.open) return;
      evento.preventDefault();
      cerrarMenu();
    });
  };
  const close = () => drawer?.close();
  const update = () => {
    document
      .querySelector(".workspace")
      ?.classList.toggle("sidebar-collapsed", collapsed);
    const button = document.getElementById("open-services");
    if (!button) return;
    const label = desktopMode.matches
      ? collapsed
        ? "Expandir menú lateral"
        : "Contraer menú lateral"
      : "Abrir menú de servicios";
    button.setAttribute("aria-label", label);
    if (desktopMode.matches) {
      button.setAttribute("aria-controls", "sidebar-services");
      button.removeAttribute("aria-haspopup");
    } else {
      button.removeAttribute("aria-controls");
      button.setAttribute("aria-haspopup", "dialog");
    }
    button.title = label;
    button.setAttribute(
      "aria-expanded",
      String(desktopMode.matches ? !collapsed : !!drawer?.open),
    );
    button.innerHTML = U.icon(
      desktopMode.matches
        ? collapsed
          ? "panel-left-open"
          : "panel-left-close"
        : "menu",
    );
    U.icons();
  };
  const toggle = (usuario, alCerrarSesion) => {
    if (!desktopMode.matches) {
      open(usuario, alCerrarSesion);
      return;
    }
    collapsed = !collapsed;
    try {
      localStorage.setItem("vales.sidebar.collapsed", String(collapsed));
    } catch {}
    update();
  };
  const active = (route) => {
    rutaActiva = route;
    document.querySelectorAll(".service-nav [data-route]").forEach((b) => {
      if (b.dataset.route === route) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
  };
  const open = (usuario, alCerrarSesion) => {
    if (drawer) return;
    const origin = document.activeElement;
    drawer = document.createElement("dialog");
    drawer.className = "navigation-drawer";
    drawer.setAttribute("aria-label", "Menú de servicios");
    drawer.innerHTML = `<div class="drawer-heading">${U.brand()}<button type="button" class="icon-btn" data-nav-close aria-label="Cerrar menú">${U.icon("x")}</button></div>${links()}${perfil(usuario)}`;
    document.getElementById("overlays").append(drawer);
    drawer.querySelector("[data-nav-close]").addEventListener("click", close);
    activarPerfil(drawer, alCerrarSesion);
    drawer.addEventListener(
      "close",
      () => {
        drawer.remove();
        drawer = null;
        update();
        if (origin?.isConnected) origin.focus();
      },
      { once: true },
    );
    drawer.showModal();
    update();
    active(rutaActiva);
    U.icons();
  };
  document.addEventListener("click", evento => {
    for (const menu of document.querySelectorAll(".sidebar-profile[open]")) {
      if (!menu.contains(evento.target)) menu.open = false;
    }
  });
  desktopMode.addEventListener("change", update);
  return { desktop, activarPerfil, active, close, toggle, update };
})();
