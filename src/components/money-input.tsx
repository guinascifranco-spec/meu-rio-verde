import { Input } from "@/components/ui/input";

export function MoneyInput({
  value,
  onChange,
  ...rest
}: {
  value: number | "";
  onChange: (v: number | "") => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <Input
      inputMode="decimal"
      placeholder="0,00"
      value={value === "" ? "" : String(value).replace(".", ",")}
      onChange={(e) => {
        const raw = e.target.value.replace(/\./g, "").replace(",", ".");
        if (raw === "") return onChange("");
        const n = Number(raw);
        if (!Number.isNaN(n)) onChange(n);
      }}
      {...rest}
    />
  );
}