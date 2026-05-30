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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTransaction, updateTransaction } from "@/lib/api/fintrack.functions";
import { CATEGORIES } from "@/lib/format";

type TxInitial = {
  id: string;
  type: "income" | "expense";
  amount: number | string;
  category: string;
  description?: string | null;
  date: string;
};

export function TransactionDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: TxInitial | null;
}) {
  const qc = useQueryClient();
  const create = useServerFn(createTransaction);
  const update = useServerFn(updateTransaction);
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState<number | "">("");
  const [category, setCategory] = useState("Alimentação");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setType(initial.type);
      setAmount(Number(initial.amount));
      setCategory(initial.category);
      setDescription(initial.description ?? "");
      setDate(initial.date);
    } else {
      setType("expense");
      setAmount("");
      setCategory("Alimentação");
      setDescription("");
      setDate(new Date().toISOString().slice(0, 10));
    }
  }, [open, initial]);

  const m = useMutation({
    mutationFn: async () => {
      if (amount === "" || !category) throw new Error("Preencha todos os campos");
      const payload = { type, amount: Number(amount), category, description, date };
      if (initial) return update({ data: { id: initial.id, ...payload } });
      return create({ data: payload });
    },
    onSuccess: () => {
      toast.success(initial ? "Transação atualizada" : "Transação criada");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar transação" : "Nova transação"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={type === "expense" ? "default" : "outline"}
              onClick={() => setType("expense")}
              className="rounded-xl"
            >
              Despesa
            </Button>
            <Button
              type="button"
              variant={type === "income" ? "default" : "outline"}
              onClick={() => setType("income")}
              className="rounded-xl"
            >
              Receita
            </Button>
          </div>
          <div className="grid gap-1.5">
            <Label>Valor</Label>
            <MoneyInput value={amount} onChange={setAmount} />
          </div>
          <div className="grid gap-1.5">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Descrição</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Data</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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