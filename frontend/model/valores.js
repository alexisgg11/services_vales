export const centesimos = valor => Math.round(Number(valor ?? 0) * 100);
export const aDecimal = valor => (valor / 100).toFixed(2);
export const identificador = valor => valor == null ? "" : String(valor);
