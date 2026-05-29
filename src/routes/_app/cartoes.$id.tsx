import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MoneyInput } from "@/components/money-input";
import { EmptyState } from "@/components/empty-state";
import {
  getCardWithPurchases,
  createCardPurchase,
  deleteCardPurchase,
} from "@/lib/api/fintrack.functions";
import { formatBRL, formatDateBR, CATEGORIES } from "@/lib/format";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/cartoes/$id")({
  head: () => ({ meta: [{ title: "Fatura — FinTrack" }] }),
  component: CardDetail,
});

function CardDetail() {
  const { id } = Route.useParams();
  const get = useServerFn(getCardWithPurchases);
  const create = useServerFn(createCardPurchase);
  const del = useServerFn(deleteCardPurchase);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["card", id],
    queryFn: () => get({ data: { id } }),
  });

  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState("Outros");
  const [installments, setInstallments] = useState(1);

  const m = useMutation({
    mutationFn: async () => {
      if (!desc || amount === "") throw new Error("Preencha todos os campos");
      return create({
        data: { card_id: id, description: desc, amount: Number(amount), date, category, installments },
      });
    },
    onSuccess: () => {
      toast.success("Compra registrada");
      qc.invalidateQueries({ queryKey: ["card", id] });
      qc.invalidateQueries({ queryKey: ["cards"] });
      setOpen(false);
      setDesc(""); setAmount(""); setInstallments(1);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: async (pid: string) => del({ data: { id: pid } }),
    onSuccess: () => {
      toast.success("Compra removida");
      qc.invalidateQueries({ queryKey: ["card", id] });
      qc.invalidateQueries({ queryKey: ["cards"] });
    },
  });

  if (q.isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  const card = q.data?.card;
  const purchases = q.data?.purchases ?? [];
  if (!card) return <p>Cartão não encontrado</p>;

  return (
    <div className="space-y-6">
      <Link to="/cartoes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{card.name}</h1>
          <p className="text-sm text-muted-foreground">
            Fecha dia {card.closing_day} · Vence dia {card.due_day}
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="rounded-xl">
          <Plus className="mr-1 h-4 w-4" /> Nova compra
        </Button>
      </div>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Compras</CardTitle></CardHeader>
        <CardContent className="p-0">
          {purchases.length === 0 ? (
            <div className="p-6">
              <EmptyState icon="🛍️" title="Nenhuma compra ainda" />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {purchases.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateBR(p.date)} · {p.category}
                    </p>
                  </div>
                  <span className="font-semibold">{formatBRL(p.amount)}</span>
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => delM.mutate(p.id)}
                    className="rounded-lg text-muted-foreground hover:text-rose-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader><DialogTitle>Nova compra</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Descrição</Label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Valor total</Label>
              <MoneyInput value={amount} onChange={setAmount} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Data</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Parcelas</Label>
                <Select value={String(installments)} onValueChange={(v) => setInstallments(Number(v))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }).map((_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}x</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={() => m.mutate()} disabled={m.isPending} className="rounded-xl">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}