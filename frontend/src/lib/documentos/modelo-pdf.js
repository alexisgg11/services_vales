import formato from "../formato.js";
// A single data model feeds the downloadable PDF and its accessible preview.
export function modeloPdf(v) {
  const model = (v) => ({
    code: formato.code(v),
    state: formato.states[v.state],
    info: [
      ["Fecha de emisión", formato.date(v.emission)],
      ["Contrato", v.contract],
      ...(v.third
        ? [
            ["Tercero", v.third],
            ["Destino o motivo", v.destination],
          ]
        : []),
      ["Proveedor", v.providerName],
      ["RUC", v.provider],
      ["Trabajador", v.workerName],
      ["DNI del trabajador", v.workerDocument || "Se verifica en el grifo"],
      ["Unidad organizativa", v.org],
      ["Centro de costo", v.center],
      ...(v.centerLocality ? [["Localidad del centro", v.centerLocality]] : []),
      ...(v.centerLocationReference
        ? [["Ubicación de referencia", v.centerLocationReference]]
        : []),
      ["Zonal / localidad", v.zone + " / " + v.locality],
      ["Unidad móvil", v.plate || "Sin unidad móvil"],
      ...(v.unitBase ? [["Zonal base de la unidad", v.unitBase]] : []),
    ],
    supply: v.supplyName,
    quantity: formato.qty(v.quantity) + " gal",
    price: formato.money(v.price),
    comparison: [
      {
        stage: "Emitido",
        quantity: formato.qty(v.quantity),
        price: formato.qty(v.price),
        amount: formato.qty(formato.amount(v.quantity, v.price)),
        estimated: true,
      },
      ...(v.consumption
        ? [
            {
              stage: "Atendido",
              quantity: formato.qty(v.consumed),
              price: formato.qty(v.real),
              amount: formato.qty(v.amount),
              estimated: false,
            },
          ]
        : []),
    ],
    consumption: v.consumption
      ? [
          ["Fecha de consumo", formato.date(v.consumption)],
          ["Ticket del grifo", v.ticket],
          ["Cantidad consumida", formato.qty(v.consumed) + " gal"],
          ["Precio real por galón", formato.money(v.real)],
        ]
      : [],
    amount: formato.money(v.amount),
    invoice: v.invoiceNumber || "",
    note: v.note || "Sin observación",
    actors: [
      ["Registrado por", v.registeredBy, v.registeredAt || v.emission],
      ["Autorizado por", v.authorizedBy, v.authorized],
      ...(v.attendedBy
        ? [["Atendido por", v.attendedBy, v.attendedAt || v.consumption]]
        : []),
    ],
  });
  return model(v);
}
