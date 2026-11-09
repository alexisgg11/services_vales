import F from "../shared/formato.js";

// Reusable accessible step navigation. Validation and content belong to each view.
export class Wizard {
  constructor(form, { steps, validate = () => true, onChange = () => {} }) {
    this.form = form;
    this.steps = steps;
    this.validate = validate;
    this.onChange = onChange;
    this.index = 0;
    this.furthest = 0;
    form.querySelector("[data-wizard-nav]").innerHTML = steps
      .map(
        (label, i) =>
          `<li><button type="button" data-step="${i}" aria-controls="step-${i}"><span class="step-number">${i + 1}</span><span>${F.escape(label)}</span></button></li>`,
      )
      .join("");
    form.addEventListener("click", (event) => {
      const button = event.target.closest(
        "[data-step],[data-next],[data-prev]",
      );
      if (!button) return;
      const target = button.hasAttribute("data-next")
        ? this.index + 1
        : button.hasAttribute("data-prev")
          ? this.index - 1
          : Number(button.dataset.step);
      this.go(target);
    });
    form.addEventListener("keydown", (event) => {
      // Enter advances the current step; it never submits a hidden review step.
      if (event.key === "Enter" && event.target.matches("input,select")) {
        event.preventDefault();
        if (this.index < steps.length - 1) this.go(this.index + 1);
      }
    });
    this.show(false);
  }
  go(target) {
    if (target < 0 || target >= this.steps.length) return;
    if (target > this.index) {
      for (let i = this.index; i < target; i++) {
        if (!this.validate(i)) return;
      }
    }
    this.index = target;
    this.furthest = Math.max(this.furthest, target);
    this.show(true);
  }
  reset() {
    this.index = 0;
    this.furthest = 0;
    this.show(false);
  }
  show(focus) {
    this.form.querySelectorAll("[data-step-panel]").forEach((panel, i) => {
      panel.hidden = i !== this.index;
    });
    this.form.querySelectorAll("[data-step]").forEach((button, i) => {
      button.disabled = i > this.furthest + 1;
      button.classList.toggle("complete", i < this.index);
      if (i === this.index) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
    this.form.querySelector("[data-prev]").hidden = this.index === 0;
    this.form.querySelector("[data-next]").hidden =
      this.index === this.steps.length - 1;
    this.form.querySelector("[data-wizard-submit]").hidden =
      this.index !== this.steps.length - 1;
    this.onChange(this.index);
    if (focus)
      this.form
        .querySelector("[data-step-panel]:not([hidden]) h2")
        ?.focus({ preventScroll: true });
  }
}
