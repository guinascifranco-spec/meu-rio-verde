import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/money-input";
import { Switch } from "@/components/ui/switch";
import { createBill, updateBill } from "@/lib/api/fintrack.functions";

type BillInitial = {
  id: string;
  type: "payable" | "receivable";
  amount: number | string;
  description: string;
  due_date: string;
  recurring: boolean;
};

export function BillDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: BillInitial | null;
}) {
  const qc = useQueryClient();
  const create = useServerFn(createBill);
  const update = useServerFn(updateBill);
  const [type, setType] = useState<"payable" | "receivable">("payable");
  const [amount, setAmount] = useState<number | "">("");
  const [description, setDescription] = useState("");
  const [due, setDue] = useState(new Date().toISOString().slice(0, 10));
  const [recurring, setRecurring] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setType(initial.type);
      setAmount(Number(initial.amount));
      setDescription(initial.description);
      setDue(initial.due_date);
      setRecurring(initial.recurring);
    } else {
      setType("payable");
      setAmount("");
      setDescription("");
      setDue(new Date().toISOString().slice(0, 10));
      setRecurring(false);
    }
  }, [open, initial]);

  const m = useMutation({
    mutationFn: async () => {
      if (amount === "" || !description) throw new Error("Preencha todos os campos");
      const payload = { type, amount: Number(amount), description, due_date: due, recurring };
      if (initial) return update({ data: { id: initial.id, ...payload } });
      return create({ data: payload });
    },
    onSuccess: () => {
      toast.success(initial ? "Conta atualizada" : "Conta criada");
      qc.invalidateQueries({ queryKey: ["bills"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar conta" : "Nova conta"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={type === "payable" ? "default" : "outline"}
              onClick={() => setType("payable")}
              className="rounded-xl"
            >
              A pagar
            </Button>
            <Button
              type="button"
              variant={type === "receivable" ? "default" : "outline"}
              onClick={() => setType("receivable")}
              className="rounded-xl"
            >
              A receber
            </Button>
          </div>
          <div className="grid gap-1.5">
            <Label>Descrição</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Conta de luz"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Valor</Label>
            <MoneyInput value={amount} onChange={setAmount} />
          </div>
          <div className="grid gap-1.5">
            <Label>Vencimento</Label>
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
            <Label htmlFor="rec" className="cursor-pointer">
              Conta recorrente
            </Label>
            <Switch id="rec" checked={recurring} onCheckedChange={setRecurring} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancelar
          </Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending} className="rounded-xl">
            {m.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}