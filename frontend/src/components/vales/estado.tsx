import { Badge } from "@/components/ui/badge";
import { states } from "@/lib/api";
import type { Vale } from "@/lib/types";

export function State({ vale }: { vale: Vale }) {
  return (
    <Badge variant="outline" className={"state state-" + vale.estado_vale}>
      {states[vale.estado_vale]}
    </Badge>
  );
}
