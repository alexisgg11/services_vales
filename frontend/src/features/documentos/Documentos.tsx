import { useState } from "react";
import { Search, matches, useData } from "@/components/common";
import { ValesList } from "@/components/vales-list";
import type { Vale } from "@/lib/types";
export default function Documentos({ onOpen }: { onOpen: (v: Vale) => void }) {
  const { data } = useData(),
    [q, setQ] = useState(""),
    [estado, setEstado] = useState("");
  return (
    <div className="stack">
      <div className="toolbar">
        <Search value={q} onChange={setQ} />
        <select
          aria-label="Estado del vale"
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="0">Emitido</option>
          <option value="1">Autorizado</option>
          <option value="3">Usado</option>
          <option value="4">Anulado</option>
        </select>
      </div>
      <ValesList
        vales={data!.vales.filter(
          (v) => matches(v, q) && (!estado || String(v.estado_vale) === estado),
        )}
        onOpen={onOpen}
      />
    </div>
  );
}
