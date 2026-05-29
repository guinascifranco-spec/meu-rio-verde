import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { MoneyInput } from "@/components/money-input";
import { EmptyState } from "@/components/empty-state";
import { listCards, createCard, deleteCard } from "@/lib/api/fintrack.functions";
import { formatBRL } from "@/lib/format";
import { Plus, Trash2, CreditCard } from "lucide-react";

export const Route = createFileRoute("/_app/cartoes/")({
  head: () => ({ meta: [{ title: "Cartões — FinTrack" }] }),
  component: Cartoes,
});

function Cartoes() {
  const list = useServerFn(listCards);
  const create = useServerFn(createCard);
  const del = useServerFn(deleteCard);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["cards"], queryFn: () => list() });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [limit, setLimit] = useState<number | "">("");
  const [closing, setClosing] = useState<number | "">(1);
  const [due, setDue] = useState<number | "">(10);
  const [color, setColor] = useState("#10B981");
  const [brand, setBrand] = useState("");

  const m = useMutation({
    mutationFn: async () => {
      if (!name || limit === "" || closing === "" || due === "")
        throw new Error("Preencha todos os campos");
      return create({
        data: {
          name,
          credit_limit: Number(limit),
          closing_day: Number(closing),
          due_day: Number(due),
          color,
          brand: brand || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Cartão criado");
      qc.invalidateQueries({ queryKey: ["cards"] });
      setOpen(false);
      setName("");
      setLimit("");
      setBrand("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: async (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Cartão removido");
      qc.invalidateQueries({ queryKey: ["cards"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Cartões</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas faturas</p>
        </div>
        <Button onClick={() => setOpen(true)} className="rounded-xl">
          <Plus className="mr-1 h-4 w-4" /> Novo cartão
        </Button>
      </div>

      {q.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState
          icon="💳"
          title="Sem cartões"
          description="Cadastre seu primeiro cartão para acompanhar faturas."
          actionLabel="Novo cartão"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data!.map((c) => {
            const pct = Math.min(100, (c.total_used / Number(c.credit_limit)) * 100);
            return (
              <Card key={c.id} className="overflow-hidden rounded-2xl">
                <div className="p-5 text-white" style={{ backgroundColor: c.color }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <CreditCard className="mb-3 h-6 w-6" />
                      <p className="text-xs uppercase opacity-80">{c.brand ?? "Cartão"}</p>
                      <p className="text-lg font-semibold">{c.name}</p>
                    </div>
                    <button onClick={() => delM.mutate(c.id)} className="opacity-70 hover:opacity-100">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Fatura atual</p>
                      <p className="text-xl font-bold">{formatBRL(c.current_invoice)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Fecha dia {c.closing_day}</p>
                      <p className="text-xs text-muted-foreground">Vence dia {c.due_day}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-muted-foreground">Limite usado</span>
                      <span className="font-medium">
                        {formatBRL(c.total_used)} / {formatBRL(c.credit_limit)}
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                  <Link
                    to="/cartoes/$id"
                    params={{ id: c.id }}
                    className="mt-4 inline-flex w-full"
                  >
                    <Button variant="outline" className="w-full rounded-xl">
                      Ver fatura
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader><DialogTitle>Novo cartão</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Nubank" />
            </div>
            <div className="grid gap-1.5">
              <Label>Bandeira</Label>
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Visa, Master..." />
            </div>
            <div className="grid gap-1.5">
              <Label>Limite</Label>
              <MoneyInput value={limit} onChange={setLimit} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Dia fechamento</Label>
                <Input
                  type="number" min={1} max={31}
                  value={closing}
                  onChange={(e) => setClosing(e.target.value ? Number(e.target.value) : "")}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Dia vencimento</Label>
                <Input
                  type="number" min={1} max={31}
                  value={due}
                  onChange={(e) => setDue(e.target.value ? Number(e.target.value) : "")}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Cor</Label>
              <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-20 p-1" />
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