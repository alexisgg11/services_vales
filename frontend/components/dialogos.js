import F from "../shared/formato.js";
import { icon, icons, button } from "./controles.js";

const e = F.escape;
const sheet = ({
  title,
  subtitle = "",
  content,
  footer = "",
  compact = false,
  centered = false,
  headingIcon = "",
  showClose = true,
  onClose = () => {},
}) => {
  const origin = document.activeElement,
    dialog = document.createElement("dialog");
  dialog.className = compact
    ? "confirmation"
    : centered
      ? "operation-dialog"
      : "sheet";
  const label = "dialog-" + Math.random().toString(36).slice(2);
  dialog.setAttribute("aria-labelledby", label);
  dialog.innerHTML = `<div class="sheet-inner"><div class="sheet-header"><div>${headingIcon ? `<span class="sheet-heading-icon">${icon(headingIcon)}</span>` : ""}<h2 id="${label}">${e(title)}</h2>${subtitle ? `<p>${e(subtitle)}</p>` : ""}</div>${showClose ? `<button type="button" class="icon-btn" data-close aria-label="Cerrar panel">${icon("x")}</button>` : ""}</div><div class="sheet-body">${content}</div>${footer ? `<div class="sheet-footer">${footer}</div>` : ""}</div>`;
  document.getElementById("overlays").append(dialog);
  dialog
    .querySelectorAll("[data-close]")
    .forEach((x) => x.addEventListener("click", () => dialog.close()));
  dialog.addEventListener(
    "close",
    () => {
      onClose();
      dialog.remove();
      if (origin?.isConnected) origin.focus();
    },
    { once: true },
  );
  dialog.showModal();
  icons();
  return { root: dialog, close: () => dialog.close() };
};
const confirm = ({
  title,
  message = "",
  content = "",
  label = "Confirmar",
  cancelLabel = "Volver",
  danger = false,
  dialogClass = "",
}) =>
  new Promise((resolve) => {
    let accepted = false;
    const modal = sheet({
      title,
      content: content || `<p class="muted">${e(message)}</p>`,
      compact: !content,
      centered: !!content,
      footer:
        button(cancelLabel, { attrs: "data-close" }) +
        button(label, {
          variant: danger ? "danger" : "primary",
          attrs: "data-confirm",
        }),
      onClose: () => resolve(accepted),
    });
    if (dialogClass) modal.root.classList.add(dialogClass);
    modal.root
      .querySelector("[data-confirm]")
      .addEventListener("click", () => {
        accepted = true;
        modal.close();
      });
  });

async function confirmarCierreSesion(cerrarSesion) {
  const confirmado = await confirm({
    title: "¿Cerrar sesión?",
    message: "Para volver a Vales, tendrás que iniciar sesión.",
    label: "Cerrar sesión",
    cancelLabel: "Cancelar",
    danger: true,
  });
  if (confirmado) await cerrarSesion();
}

const notice = ({ title, message, icon: symbol, danger = false }) => {
  const modal = sheet({
    title,
    compact: true,
    headingIcon: symbol,
    showClose: false,
    content: `<p>${e(message)}</p>`,
    footer: button("Entendido", { attrs: "data-close autofocus" }),
  });
  modal.root.classList.add("notice-dialog");
  if (danger) modal.root.classList.add("notice-dialog--danger");
  return modal;
};

export { sheet, confirm, confirmarCierreSesion, notice };
