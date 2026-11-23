import { describe, expect, it } from "vitest";
import {
  confirmarPunto,
  datosParaGuardarRuta,
  partidaDelBorrador,
  seleccionarCentro,
  validarRuta,
  type BorradorRuta,
  type CentroRuta,
} from "./rutas-borrador";

const centros: CentroRuta[] = [
  { codigo: "A", nombre: "Pozo Los Algarrobos", localidad: "Piura" },
  { codigo: "B", nombre: "Pozo Pachitea", localidad: "Piura" },
];
const puntoAnterior = { latitud: -5.19, longitud: -80.65 };
const puntoLibre = { latitud: -5.2, longitud: -80.63 };
const parada = {
  clave: 3,
  centro: "A",
  nombre: centros[0].nombre,
  punto: puntoAnterior,
};
const operativos = [{ id: 1, nombre: "Rosa Gutiérrez", zonal: "01" }];
const ruta: BorradorRuta = {
  nombre: "Inspección",
  cod_zonal: "01",
  desde: "2026-11-21",
  hasta: "2026-11-22",
  activa: true,
  version: 1,
  trabajadores: [1],
  paradas: [parada],
};

describe("ubicación de paradas", () => {
  it("guarda un punto libre sin arrastrar el centro ni su nombre", () => {
    const libre = confirmarPunto(parada, puntoLibre, "libre", centros);
    expect(libre).toEqual({
      clave: 3,
      centro: null,
      nombre: "",
      punto: puntoLibre,
    });
    expect(parada.punto).toEqual(puntoAnterior);
  });

  it("conserva un nombre personalizado al pasar a un lugar independiente", () => {
    expect(
      confirmarPunto(
        { ...parada, nombre: "Revisar bomba" },
        puntoLibre,
        "libre",
        centros,
      ).nombre,
    ).toBe("Revisar bomba");
  });

  it("conserva el centro al confirmar explícitamente su ubicación", () => {
    const ubicada = confirmarPunto(parada, puntoLibre, "centro", centros);
    expect(ubicada).toEqual({ ...parada, punto: puntoLibre });
  });

  it("pide ubicar de nuevo al cambiar de centro", () => {
    const otroCentro = seleccionarCentro(parada, "B", centros);
    expect(otroCentro.nombre).toBe("Pozo Pachitea");
    expect(otroCentro.punto).toBeUndefined();
  });
});

describe("validación de una ruta", () => {
  it("distingue falta de operativos y falta de ubicación de una parada", () => {
    expect(
      validarRuta({ ...ruta, trabajadores: [] }, operativos)?.seccion,
    ).toBe("operativos");
    const pendiente = {
      clave: 7,
      centro: null,
      nombre: "Inspección en Castilla",
    };
    expect(
      validarRuta({ ...ruta, paradas: [parada, pendiente] }, operativos),
    ).toEqual({
      seccion: "paradas",
      mensaje: "Ubica la parada 2 en el mapa.",
      parada: 7,
    });
  });

  it("acepta una ruta con una parada de centro y un punto libre", () => {
    const paradas = [
      parada,
      { clave: 7, centro: null, nombre: "Inspección", punto: puntoLibre },
    ];
    expect(validarRuta({ ...ruta, paradas }, operativos)).toBeUndefined();
  });

  it("pide una partida al crear una ruta", () => {
    expect(validarRuta(ruta, operativos, true)).toEqual({
      seccion: "paradas",
      mensaje: "Indica el punto de partida de la ruta.",
    });
    expect(
      validarRuta({ ...ruta, origen: puntoLibre }, operativos, true),
    ).toBeUndefined();
  });
});

it("trata los mismos operativos como una sola selección aunque cambie el orden de los clics", () => {
  expect(datosParaGuardarRuta({ ...ruta, trabajadores: [2, 1] })).toEqual(
    datosParaGuardarRuta({ ...ruta, trabajadores: [1, 2] }),
  );
});

describe("punto de partida", () => {
  const cuenta = {
    zonales: [{ id_zona: "01", nom_zona: "PIURA" }],
    localidades: [
      { id_localidad: "05", nom_localidad: "Castilla", id_zona: "01" },
      { id_localidad: "04", nom_localidad: "Piura", id_zona: "01" },
    ],
  };
  const equipo = [
    { ...operativos[0], localidad: "05" },
    { id: 2, nombre: "Mateo Salazar", zonal: "01", localidad: "04" },
  ];

  it("propone la localidad del primer operativo asignado", () => {
    expect(
      partidaDelBorrador(cuenta, { ...ruta, trabajadores: [2, 1] }, equipo)
        ?.nombre,
    ).toBe("Piura");
    expect(
      partidaDelBorrador(cuenta, { ...ruta, trabajadores: [1, 2] }, equipo)
        ?.nombre,
    ).toBe("Castilla");
  });

  it("omite la partida sugerida si el operativo de una ruta antigua cambió de zonal", () => {
    const equipo = [{ ...operativos[0], localidad: "05", zonal: "02" }];
    expect(partidaDelBorrador(cuenta, ruta, equipo)).toBeUndefined();
  });

  it("conserva el punto confirmado al cambiar el equipo", () => {
    const guardado = { latitud: -5.22, longitud: -80.58, localidad: "05" };
    expect(
      partidaDelBorrador(
        cuenta,
        { ...ruta, origen: guardado, trabajadores: [2] },
        equipo,
      ),
    ).toMatchObject({
      ...guardado,
      nombre: "Castilla",
    });
    expect(
      partidaDelBorrador(cuenta, { ...ruta, trabajadores: [] }, equipo),
    ).toBeUndefined();
  });
});
