import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
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
import {
  listGoals,
  createGoal,
  addGoalContribution,
  deleteGoal,
  updateGoal,
} from "@/lib/api/fintrack.functions";
import { formatBRL, formatDateBR } from "@/lib/format";
import { Plus, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/_app/metas")({
  head: () => ({ meta: [{ title: "Metas — MonetaRio" }] }),
  component: Metas,
});

function Metas() {
  const list = useServerFn(listGoals);
  const create = useServerFn(createGoal);
  const update = useServerFn(updateGoal);
  const contribute = useServerFn(addGoalContribution);
  const del = useServerFn(deleteGoal);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["goals"], queryFn: () => list() });
  const [openNew, setOpenNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contribGoal, setContribGoal] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [target, setTarget] = useState<number | "">("");
  const [deadline, setDeadline] = useState("");
  const [emoji, setEmoji] = useState("🎯");
  const [contribAmount, setContribAmount] = useState<number | "">("");

  useEffect(() => {
    if (!openNew) return;
    if (editingId) {
      const g = (q.data ?? []).find((x) => x.id === editingId);
      if (g) {
        setName(g.name);
        setTarget(Number(g.target_amount));
        setDeadline(g.deadline ?? "");
        setEmoji(g.emoji);
      }
    } else {
      setName("");
      setTarget("");
      setDeadline("");
      setEmoji("🎯");
    }
  }, [openNew, editingId, q.data]);

  const createM = useMutation({
    mutationFn: async () => {
      if (!name || target === "") throw new Error("Preencha nome e valor");
      const payload = { name, target_amount: Number(target), deadline: deadline || null, emoji };
      if (editingId) return update({ data: { id: editingId, ...payload } });
      return create({ data: payload });
    },
    onSuccess: () => {
      toast.success(editingId ? "Meta atualizada" : "Meta criada");
      qc.invalidateQueries({ queryKey: ["goals"] });
      setOpenNew(false);
      setEditingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const contribM = useMutation({
    mutationFn: async () => {
      if (!contribGoal || contribAmount === "") throw new Error("Informe o valor");
      return contribute({ data: { goal_id: contribGoal, amount: Number(contribAmount) } });
    },
    onSuccess: () => {
      toast.success("Aporte registrado");
      qc.invalidateQueries({ queryKey: ["goals"] });
      setContribGoal(null);
      setContribAmount("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: async (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Meta removida");
      qc.invalidateQueries({ queryKey: ["goals"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Metas de Economia</h1>
          <p className="text-sm text-muted-foreground">Acompanhe seus objetivos financeiros</p>
        </div>
        <Button onClick={() => { setEditingId(null); setOpenNew(true); }} className="rounded-xl">
          <Plus className="mr-1 h-4 w-4" /> Nova meta
        </Button>
      </div>

      {q.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState
          icon="🎯"
          title="Você ainda não tem metas. Crie a primeira!"
          actionLabel="Nova meta"
          onAction={() => { setEditingId(null); setOpenNew(true); }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {q.data!.map((g) => {
            const pct = Math.min(100, (g.saved / Number(g.target_amount)) * 100);
            const overdue = g.deadline && new Date(g.deadline) < new Date() && pct < 100;
            const achieved = pct >= 100;
            const status = achieved ? "Concluída" : overdue ? "Atrasada" : "Em andamento";
            return (
              <Card key={g.id} className="rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{g.emoji}</span>
                      <div>
                        <p className="font-semibold">{g.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {g.deadline ? `Até ${formatDateBR(g.deadline)}` : "Sem prazo"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditingId(g.id); setOpenNew(true); }}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => delM.mutate(g.id)}
                        className="text-muted-foreground hover:text-rose-500"
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium">{formatBRL(g.saved)}</span>
                      <span className="text-muted-foreground">{formatBRL(g.target_amount)}</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                    <div className="mt-2 flex items-center justify-between">
                      <span
                        className={`text-xs font-medium ${
                          achieved
                            ? "text-emerald-600"
                            : overdue
                              ? "text-rose-500"
                              : "text-muted-foreground"
                        }`}
                      >
                        {status} · {pct.toFixed(0)}%
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setContribGoal(g.id)}
                        className="rounded-lg"
                      >
                        Aportar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={openNew} onOpenChange={(o) => { setOpenNew(o); if (!o) setEditingId(null); }}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar meta" : "Nova meta"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Emoji</Label>
              <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} />
            </div>
            <div className="grid gap-1.5">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Viagem" />
            </div>
            <div className="grid gap-1.5">
              <Label>Valor alvo</Label>
              <MoneyInput value={target} onChange={setTarget} />
            </div>
            <div className="grid gap-1.5">
              <Label>Prazo (opcional)</Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button onClick={() => createM.mutate()} disabled={createM.isPending} className="rounded-xl">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!contribGoal} onOpenChange={(o) => !o && setContribGoal(null)}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar aporte</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5 py-2">
            <Label>Valor</Label>
            <MoneyInput value={contribAmount} onChange={setContribAmount} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContribGoal(null)} className="rounded-xl">
              Cancelar
            </Button>
            <Button onClick={() => contribM.mutate()} disabled={contribM.isPending} className="rounded-xl">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}