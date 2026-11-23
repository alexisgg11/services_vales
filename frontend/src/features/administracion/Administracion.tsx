import { useQuery } from "@tanstack/react-query";
import { Busy, ErrorText } from "@/components/ui/feedback";
import { useData } from "@/lib/consultas";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import Accesos from "./Accesos";
import Precios from "./Precios";
import Unidades from "./Unidades";
import type { AdminDatos } from "./administracion-datos";
import "./administracion.css";

export default function Administracion() {
  const { data: contexto } = useData();
  const { data, error, isPending } = useQuery({
    queryKey: ["administracion"],
    queryFn: () => api<AdminDatos>("/api/administracion"),
  });
  if (isPending) return <Busy />;
  if (!data || !contexto) return <ErrorText error={error} />;

  return (
    <Tabs defaultValue="accesos" className="administracion">
      <TabsList aria-label="Configuración de Administración">
        <TabsTrigger value="accesos">Accesos</TabsTrigger>
        <TabsTrigger value="precios">Precios</TabsTrigger>
        <TabsTrigger value="unidades">Unidades</TabsTrigger>
      </TabsList>
      <ErrorText error={error} />
      <TabsContent value="accesos">
        <Accesos datos={data} cuenta={contexto.cuenta} />
      </TabsContent>
      <TabsContent value="precios">
        <Precios tarifas={data.tarifas} cuenta={contexto.cuenta} />
      </TabsContent>
      <TabsContent value="unidades">
        <Unidades zonales={contexto.cuenta.zonales} />
      </TabsContent>
    </Tabs>
  );
}
