import {
  queryOptions,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { api } from "./api";
import type { Contexto, Vale } from "./types";

export const contextoConsulta = queryOptions({
  queryKey: ["contexto"] as const,
  queryFn: ({ signal }) => api<Contexto>("/api/aplicacion", undefined, signal),
  staleTime: 30_000,
  retry: false,
});

export function useData() {
  return useQuery(contextoConsulta);
}

export function useRefresh() {
  const cache = useQueryClient();
  return async (...claves: QueryKey[]) => {
    if (claves.length === 0) return cache.invalidateQueries();
    await Promise.all(
      claves.map((queryKey) => cache.invalidateQueries({ queryKey })),
    );
  };
}

export const detalleValeConsulta = (idQr: string) =>
  queryOptions({
    queryKey: ["detalle-vale", idQr] as const,
    queryFn: ({ signal }) =>
      api<{ vale: Vale }>(
        "/api/v1/documentos/" + encodeURIComponent(idQr),
        undefined,
        signal,
      ),
    staleTime: 15_000,
  });

export async function actualizarContexto(
  cliente: QueryClient,
  contexto: Contexto,
) {
  const { queryKey } = contextoConsulta;
  await cliente.cancelQueries({ queryKey, exact: true });
  cliente.setQueryData(queryKey, contexto);
}

export function invalidarDetalles(
  cliente: QueryClient,
  vales: readonly Pick<Vale, "id_qr">[],
) {
  return Promise.all(
    vales.map(({ id_qr }) =>
      cliente.invalidateQueries({
        queryKey: detalleValeConsulta(id_qr).queryKey,
      }),
    ),
  );
}
