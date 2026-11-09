import * as ui from "../../components/controles.js";
import { obtenerCsrf } from "../../api/cliente-http.js";

export default function mostrarAcceso() {
  document.getElementById("app").innerHTML =
    `<main class="access-page"><div class="access-layout"><section class="access-intro">${ui.brand()}<div class="access-message"><span class="access-kicker">SERVICIOS DE COMBUSTIBLE</span><h1>Cada vale,<br>en su lugar.</h1><p>Emisión, atención y control<br>en un solo espacio.</p><div class="access-illustration" aria-hidden="true"><div class="illustration-ticket">${ui.icon("ticket")}<div><span>VALE DE COMBUSTIBLE</span><strong>Listo para continuar</strong></div><span class="illustration-check">${ui.icon("check")}</span></div><div class="illustration-line"></div><span class="illustration-fuel">${ui.icon("fuel")}</span></div></div><span class="access-footnote">Acceso por perfil</span></section><section class="access-card"><span class="access-eyebrow">BIENVENIDO</span><h2>Ingresa a tu cuenta</h2><form id="login-form" class="access-form">${ui.field("Usuario", ui.input("username", "text", "", 'required autocomplete="username"'), { name: "username", icon: "user-round" })}${ui.field("Contraseña", `<div class="password-wrap">${ui.input("password", "password", "", 'required autocomplete="current-password"')}<button class="icon-btn" id="show-password" type="button" aria-label="Mostrar contraseña" aria-pressed="false">${ui.icon("eye")}</button></div>`, { name: "password", icon: "lock-keyhole" })}${ui.button("Ingresar", { type: "submit", variant: "primary", icon: "arrow-right" })}</form></section></div></main>`;
  const form = document.getElementById("login-form");
  form.method = "post";
  form.action = "/login";
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  obtenerCsrf().then(({ token }) => {
    form.insertAdjacentHTML("beforeend", ui.input("_csrf", "hidden", token));
    submit.disabled = false;
  }).catch(error => ui.error(form, error.message));
  if (new URLSearchParams(location.search).has("error"))
    ui.error(form, "Revisa el usuario y la contraseña.");
  document.getElementById("show-password").addEventListener("click", (ev) => {
    const password = form.elements.password,
      show = password.type === "password";
    password.type = show ? "text" : "password";
    ev.currentTarget.setAttribute("aria-pressed", String(show));
    ev.currentTarget.setAttribute(
      "aria-label",
      show ? "Ocultar contraseña" : "Mostrar contraseña",
    );
  });
  ui.icons();
}
