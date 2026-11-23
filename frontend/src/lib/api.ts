import { limpiarBorradores } from "./almacenamiento";

let csrf: { header: string; token: string } | undefined;
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function token() {
  if (!csrf) {
    const r = await fetch("/api/csrf", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!r.ok) throw new ApiError(r.status, "No se pudo preparar la sesión.");
    csrf = await r.json();
  }
  return csrf!;
}
export async function api<T>(
  url: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) {
    if (!navigator.onLine)
      throw new ApiError(
        0,
        "Sin conexión. Recupera la conexión y confirma la operación para guardar.",
      );
    const t = await token();
    headers["Content-Type"] = "application/json";
    headers[t.header] = t.token;
  }
  const r = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal,
  });
  if (!r.ok) {
    const data = await r.json().catch(() => null);
    if (r.status === 401) {
      csrf = undefined;
      limpiarBorradores();
    }
    throw new ApiError(
      r.status,
      data?.detail ||
        data?.message ||
        (r.status === 401
          ? "La sesión terminó. Inicia sesión de nuevo."
          : "No se pudo completar la operación."),
    );
  }
  return r.json();
}
export async function login(usuario: string, clave: string) {
  const t = await token();
  const r = await fetch("/login", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      [t.header]: t.token,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ username: usuario, password: clave }),
  });
  csrf = undefined;
  if (!r.ok || r.url.includes("?error"))
    throw new Error("Usuario o contraseña incorrectos.");
  return r.url;
}
export async function logout() {
  const t = await token();
  const r = await fetch("/logout", {
    method: "POST",
    credentials: "same-origin",
    headers: { [t.header]: t.token },
  });
  if (!r.ok) throw new Error("No se pudo cerrar la sesión.");
  csrf = undefined;
  limpiarBorradores();
  location.assign("/app/login");
}
export const money = (v: number | null | undefined) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(
    v ?? 0,
  );
export const qty = (v: number | null | undefined) =>
  new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v ?? 0);
export const cents = (v: number) => Math.round(v * 100);
export const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Lima" }).format(
    new Date(),
  );
export const date = (v: string | null | undefined) =>
  v
    ? new Intl.DateTimeFormat("es-PE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(v.length === 10 ? v + "T12:00:00" : v))
    : "Sin registro";
export const states: Record<number, string> = {
  0: "Emitido",
  1: "Autorizado",
  3: "Usado",
  4: "Anulado",
};
