import F from "../shared/formato.js";
import { servicios } from "../router/servicios.js";

const e = F.escape;
const icon = (name) => `<i data-lucide="${e(name)}" aria-hidden="true"></i>`;
const icons = () =>
  window.lucide?.createIcons({ attrs: { "aria-hidden": "true" } });
const button = (
  label,
  {
    icon: ic = "",
    variant = "",
    id = "",
    type = "button",
    disabled = false,
    attrs = "",
  } = {},
) =>
  `<button type="${type}" ${id ? `id="${e(id)}"` : ""} class="btn ${variant ? "btn--" + variant : ""}" ${disabled ? "disabled" : ""} ${attrs}>${ic ? icon(ic) : ""}${e(label)}</button>`;
const iconAction = (label, name, attrs = "") =>
  `<button type="button" class="icon-btn icon-btn--action" aria-label="${e(label)}" title="${e(label)}" ${attrs}>${icon(name)}</button>`;
const input = (name, type = "text", value = "", attrs = "") =>
  `<input id="${e(name)}" name="${e(name)}" type="${e(type)}" value="${e(value)}" ${attrs}>`;
const select = (name, items, value = "", attrs = "") =>
  `<select id="${e(name)}" name="${e(name)}" ${attrs}>${items.map((x) => `<option value="${e(x.value ?? x.id)}" ${String(x.value ?? x.id) === String(value) ? "selected" : ""}>${e(x.label ?? x.name)}</option>`).join("")}</select>`;
const field = (
  label,
  control,
  { name = "", hint = "", wide = false, icon: ic = "" } = {},
) =>
  `<div class="field ${wide ? "wide" : ""}">${name ? `<label for="${e(name)}">${ic ? icon(ic) : ""}${e(label)}</label>` : `<span class="field-label">${ic ? icon(ic) : ""}${e(label)}</span>`}${control}${hint ? `<small>${e(hint)}</small>` : ""}</div>`;
const badge = (state) =>
  `<span class="badge badge--${Number(state)}">${e(F.states[state])}</span>`;
const empty = (title, description = "") =>
  `<div class="empty">${icon("inbox")}<strong>${e(title)}</strong><span>${e(description)}</span></div>`;
const brand = () =>
  `<div class="brand"><span class="brand-mark">${icon("fuel")}</span><div><strong>Vales</strong><small>Control de combustible</small></div></div>`;
const page = (title, content, actions = "") => {
  const service = servicios.find((s) => s.label === title);
  document.getElementById("print-document").replaceChildren();
  document.getElementById("view").innerHTML =
    `<div class="page-heading"><div class="page-title">${service ? `<span class="page-icon">${icon(service.icon)}</span>` : ""}<h1>${e(title)}</h1></div>${actions ? `<div class="page-actions">${actions}</div>` : ""}</div>${content}`;
  icons();
};
const error = (form, message) => {
  let box = form.querySelector(".form-error");
  if (!box) {
    box = document.createElement("div");
    box.className = "form-error";
    box.setAttribute("role", "alert");
    form.prepend(box);
  }
  box.textContent = message;
  box.tabIndex = -1;
  box.focus();
};
const toast = (message) => {
  const host = document.getElementById("notifications");
  host.innerHTML = `<div class="toast">${icon("circle-check")}<span>${e(message)}</span></div>`;
  icons();
  clearTimeout(host.timer);
  host.timer = setTimeout(() => host.replaceChildren(), 4200);
};

export { icon, icons, button, iconAction, input, select, field, badge, empty, brand, page, error, toast };
