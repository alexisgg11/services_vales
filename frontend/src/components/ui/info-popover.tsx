import { useId, type ReactNode } from "react";
import { Popover } from "radix-ui";
import { Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InfoPopover({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={title}>
          <Info aria-hidden="true" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="info-popover"
          sideOffset={8}
          align="end"
          collisionPadding={12}
          aria-labelledby={id}
        >
          <div className="info-popover-header">
            <strong id={id}>{title}</strong>
            <Popover.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Cerrar información"
              >
                <X />
              </Button>
            </Popover.Close>
          </div>
          <div className="info-popover-body">{children}</div>
          <Popover.Arrow className="info-popover-arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
