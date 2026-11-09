export default (() => {
  const escape = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const money = (cents) =>
    new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: "PEN",
    }).format(cents / 100);
  const qty = (hundredths) =>
    new Intl.NumberFormat("es-PE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(hundredths / 100);
  const date = (value) =>
    value
      ? new Intl.DateTimeFormat("es-PE", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).format(new Date(value + "T12:00:00"))
      : "—";
  const scaled = (value) => {
    const match = String(value)
      .replace(",", ".")
      .match(/^(\d+)(?:\.(\d{1,2}))?$/);
    if (!match) return NaN;
    const scaledValue = Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"));
    return validValue(scaledValue) ? scaledValue : NaN;
  };
  const validValue = (value) =>
    Number.isSafeInteger(value) && value > 0 && value <= 99999999999999;
  const amount = (quantity, price) =>
    Number((BigInt(quantity) * BigInt(price) + 50n) / 100n);
  const code = (vale) => vale.code || vale.id;
  const reference = (vale) => code(vale) + " (" + vale.zone + ")";
  return {
    escape,
    money,
    qty,
    date,
    scaled,
    amount,
    validValue,
    code,
    reference,
    today: new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Lima" }).format(),
    states: { 0: "Emitido", 1: "Autorizado", 3: "Usado", 4: "Anulado" },
  };
})();
