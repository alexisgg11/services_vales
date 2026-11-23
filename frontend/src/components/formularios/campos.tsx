import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { InfoPopover } from "@/components/ui/info-popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Field({
  label,
  children,
  hint,
  help,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  help?: string;
}) {
  const id = useId(),
    controlArea = useRef<HTMLDivElement>(null),
    [controlId, setControlId] = useState(id);
  useLayoutEffect(() => {
    const control = controlArea.current?.querySelector<HTMLElement>(
      'input,select,textarea,[role="combobox"]',
    );
    if (control) {
      if (!control.id) control.id = id;
      setControlId(control.id);
      if ((hint || help) && !control.getAttribute("aria-describedby"))
        control.setAttribute("aria-describedby", id + "-hint");
    }
  }, [children, id, hint, help]);
  return (
    <div className="field">
      <div className="field-label">
        <Label htmlFor={controlId}>{label}</Label>
        {help && (
          <span className="field-help">
            <InfoPopover
              title={"Información de " + label.toLocaleLowerCase("es-PE")}
            >
              <p>{help}</p>
            </InfoPopover>
          </span>
        )}
      </div>
      <div ref={controlArea}>{children}</div>
      {hint && <small id={id + "-hint"}>{hint}</small>}
      {!hint && help && (
        <span className="sr-only" id={id + "-hint"}>
          {help}
        </span>
      )}
    </div>
  );
}

export function Search({
  value,
  onChange,
  placeholder = "Buscar por código, trabajador o ticket",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
    />
  );
}
