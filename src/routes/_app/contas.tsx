import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/empty-state";
import { BillDialog } from "@/components/dialogs/bill-dialog";
import { listBills, togglePaidBill, deleteBill } from "@/lib/api/fintrack.functions";
import { formatBRL, formatDateBR } from "@/lib/format";
import { Plus, Trash2, Check } from "lucide-react";
import { parseISO, isBefore, startOfDay } from "date-fns";

export const Route = createFileRoute("/_app/contas")({
  head: () => ({ meta: [{ title: "Contas — FinTrack" }] }),
  component: Contas,
});

function Contas() {
  const list = useServerFn(listBills);
  const toggle = useServerFn(togglePaidBill);
  const del = useServerFn(deleteBill);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["bills"], queryFn: () => list() });
  const [openNew, setOpenNew] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");

  const months = useMemo(() => {
    const set = new Set<string>();
    (q.data ?? []).forEach((b) => set.add(b.due_date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [q.data]);

  const filtered = useMemo(() => {
    return (q.data ?? []).filter((b) => {
      if (filterStatus !== "all" && b.status !== filterStatus) return false;
      if (filterType !== "all" && b.type !== filterType) return false;
      if (filterMonth !== "all" && !b.due_date.startsWith(filterMonth)) return false;
      return true;
    });
  }, [q.data, filterStatus, filterType, filterMonth]);

  const today = startOfDay(new Date());

  const togM = useMutation({
    mutationFn: async (vars: { id: string; paid: boolean }) =>
      toggle({ data: vars }),
    onSuccess: () => {
      toast.success("Conta atualizada");
      qc.invalidateQueries({ queryKey: ["bills"] });
      setConfirmId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: async (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Conta removida");
      qc.invalidateQueries({ queryKey: ["bills"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Contas</h1>
          <p className="text-sm text-muted-foreground">A pagar e a receber</p>
        </div>
        <Button onClick={() => setOpenNew(true)} className="rounded-xl">
          <Plus className="mr-1 h-4 w-4" /> Nova conta
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            <SelectItem value="payable">A pagar</SelectItem>
            <SelectItem value="receivable">A receber</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-40 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os meses</SelectItem>
            {months.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-0">
          {q.isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon="🧾"
                title="Nenhuma conta encontrada"
                description="Adicione sua primeira conta a pagar ou receber."
                actionLabel="Nova conta"
                onAction={() => setOpenNew(true)}
              />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((b) => {
                const overdue =
                  b.status === "pending" && isBefore(parseISO(b.due_date), today);
                return (
                  <li key={b.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{b.description}</p>
                        {b.status === "paid" && (
                          <Badge variant="secondary" className="text-xs">Pago</Badge>
                        )}
                        {overdue && <Badge variant="destructive" className="text-xs">Vencida</Badge>}
                      </div>
                      <p className={`text-xs ${overdue ? "text-rose-500" : "text-muted-foreground"}`}>
                        Vence em {formatDateBR(b.due_date)} ·{" "}
                        {b.type === "payable" ? "A pagar" : "A receber"}
                      </p>
                    </div>
                    <span className={`font-semibold ${b.type === "payable" ? "text-rose-500" : "text-emerald-600"}`}>
                      {formatBRL(b.amount)}
                    </span>
                    <div className="flex gap-1">
                      {b.status === "pending" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmId(b.id)}
                          className="rounded-lg"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => togM.mutate({ id: b.id, paid: false })}
                          className="rounded-lg text-xs"
                        >
                          Desfazer
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => delM.mutate(b.id)}
                        className="rounded-lg text-muted-foreground hover:text-rose-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <BillDialog open={openNew} onOpenChange={setOpenNew} />

      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como paga?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação atualizará o status da conta para paga.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmId && togM.mutate({ id: confirmId, paid: true })}
              className="rounded-xl"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}