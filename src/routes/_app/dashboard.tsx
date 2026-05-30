import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listTransactions,
  listBills,
  deleteTransaction,
  listInvestments,
} from "@/lib/api/fintrack.functions";
import { formatBRL, formatDateBR } from "@/lib/format";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Plus, TrendingUp, TrendingDown, Wallet, PiggyBank, Pencil, Trash2 } from "lucide-react";
import { TransactionDialog } from "@/components/dialogs/transaction-dialog";
import { BillDialog } from "@/components/dialogs/bill-dialog";
import { EmptyState } from "@/components/empty-state";
import { addDays, startOfMonth, subMonths, format, parseISO } from "date-fns";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — MonetaRio" }],
  }),
  component: Dashboard,
});

const PIE_COLORS = ["#10B981", "#34D399", "#6EE7B7", "#A7F3D0", "#FBBF24", "#F97316", "#EF4444", "#8B5CF6", "#3B82F6", "#94A3B8"];

function Dashboard() {
  const [openTx, setOpenTx] = useState(false);
  const [openBill, setOpenBill] = useState(false);
  const [editingTx, setEditingTx] = useState<{
    id: string;
    type: "income" | "expense";
    amount: number | string;
    category: string;
    description?: string | null;
    date: string;
  } | null>(null);
  const listTx = useServerFn(listTransactions);
  const listB = useServerFn(listBills);
  const delTx = useServerFn(deleteTransaction);
  const listInv = useServerFn(listInvestments);
  const qc = useQueryClient();

  const userQ = useQuery({
    queryKey: ["supabase-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data?.user ?? null;
    },
  });

  useEffect(() => {
    if (userQ.data) {
      const user = userQ.data;
      const isGoogle = user.app_metadata?.provider === "google" || user.identities?.some(id => id.provider === "google");
      const createdAt = new Date(user.created_at).getTime();
      const nowTime = new Date().getTime();
      const isNew = (nowTime - createdAt) < 120000; // 2 minutes window
      
      const welcomeShown = localStorage.getItem(`monetario_welcome_shown_${user.id}`);
      
      if (isGoogle && isNew && !welcomeShown) {
        toast.success("Bem-vindo ao MonetaRio! 🎉 Comece adicionando sua primeira transação.", {
          duration: 8000,
        });
        localStorage.setItem(`monetario_welcome_shown_${user.id}`, "true");
      }
    }
  }, [userQ.data]);

  const txQ = useQuery({ queryKey: ["transactions"], queryFn: () => listTx() });
  const billsQ = useQuery({ queryKey: ["bills"], queryFn: () => listB() });
  const invQ = useQuery({ queryKey: ["investments"], queryFn: () => listInv() });

  const delM = useMutation({
    mutationFn: async (txId: string) => delTx({ data: { id: txId } }),
    onSuccess: () => {
      toast.success("Transação removida");
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recentTx = useMemo(
    () => (txQ.data ?? []).slice(0, 8),
    [txQ.data],
  );

  const now = new Date();
  const monthStart = startOfMonth(now);

  const monthly = useMemo(() => {
    const txs = txQ.data ?? [];
    const inMonth = txs.filter((t) => parseISO(t.date) >= monthStart);
    const income = inMonth.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const expense = inMonth.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    const balance = income - expense;
    const savings = income > 0 ? Math.max(0, (balance / income) * 100) : 0;
    return { income, expense, balance, savings };
  }, [txQ.data, monthStart]);

  const lineData = useMemo(() => {
    const txs = txQ.data ?? [];
    return Array.from({ length: 6 }).map((_, i) => {
      const d = subMonths(now, 5 - i);
      const s = startOfMonth(d);
      const e = startOfMonth(subMonths(now, 5 - i - 1));
      const month = txs.filter((t) => {
        const td = parseISO(t.date);
        return td >= s && td < e;
      });
      const inc = month.filter((t) => t.type === "income").reduce((a, t) => a + Number(t.amount), 0);
      const exp = month.filter((t) => t.type === "expense").reduce((a, t) => a + Number(t.amount), 0);
      return { mes: format(d, "MMM"), saldo: inc - exp };
    });
  }, [txQ.data, now]);

  const pieData = useMemo(() => {
    const txs = (txQ.data ?? []).filter(
      (t) => t.type === "expense" && parseISO(t.date) >= monthStart,
    );
    const map = new Map<string, number>();
    txs.forEach((t) => map.set(t.category, (map.get(t.category) ?? 0) + Number(t.amount)));
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [txQ.data, monthStart]);

  const upcoming = useMemo(() => {
    const bills = billsQ.data ?? [];
    const limit = addDays(now, 7);
    return bills
      .filter((b) => b.status === "pending" && parseISO(b.due_date) <= limit)
      .slice(0, 6);
  }, [billsQ.data, now]);

  const displayName = userQ.data?.user_metadata?.display_name || userQ.data?.user_metadata?.full_name || userQ.data?.email || "";
  const greeting = displayName ? `Olá, ${displayName} 👋` : "Olá 👋";

  const invStats = useMemo(() => {
    const invs = invQ.data ?? [];
    const totalInvested = invs.reduce((s: number, i: { invested_amount: number }) => s + Number(i.invested_amount), 0);
    const totalCurrent = invs.reduce((s: number, i: { current_value: number }) => s + Number(i.current_value), 0);
    const pct = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0;
    return { totalCurrent, pct };
  }, [invQ.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{greeting}</h1>
          <p className="text-sm text-muted-foreground">Resumo de {format(now, "MMMM 'de' yyyy")}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { setEditingTx(null); setOpenTx(true); }} className="rounded-xl">
            <Plus className="mr-1 h-4 w-4" /> Transação
          </Button>
          <Button onClick={() => setOpenBill(true)} variant="outline" className="rounded-xl">
            <Plus className="mr-1 h-4 w-4" /> Conta
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <SummaryCard
          label="Receitas"
          value={formatBRL(monthly.income || 0)}
          icon={<TrendingUp className="h-4 w-4" />}
          tone="text-emerald-600"
          loading={txQ.isLoading}
        />
        <SummaryCard
          label="Despesas"
          value={formatBRL(monthly.expense || 0)}
          icon={<TrendingDown className="h-4 w-4" />}
          tone="text-rose-500"
          loading={txQ.isLoading}
        />
        <SummaryCard
          label="Saldo"
          value={formatBRL(monthly.balance || 0)}
          icon={<Wallet className="h-4 w-4" />}
          loading={txQ.isLoading}
        />
        <SummaryCard
          label="Taxa poupança"
          value={`${(monthly.savings || 0).toFixed(0)}%`}
          icon={<PiggyBank className="h-4 w-4" />}
          loading={txQ.isLoading}
        />
        <SummaryCard
          label="Total investido"
          value={formatBRL(invStats.totalCurrent)}
          icon={<TrendingUp className="h-4 w-4" />}
          tone={invStats.pct >= 0 ? "text-emerald-600" : "text-rose-500"}
          sub={`${invStats.pct >= 0 ? "+" : ""}${invStats.pct.toFixed(1)}% rentabilidade`}
          loading={invQ.isLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Saldo nos últimos 6 meses</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {txQ.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (txQ.data ?? []).length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Dados insuficientes para exibir o gráfico
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData}>
                  <XAxis dataKey="mes" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `R$ ${v}`} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Line
                    type="monotone"
                    dataKey="saldo"
                    stroke="#10B981"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Despesas por categoria</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {txQ.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : pieData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Dados insuficientes para exibir o gráfico
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming bills */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Próximos 7 dias</CardTitle>
        </CardHeader>
        <CardContent>
          {billsQ.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : upcoming.length === 0 ? (
            <EmptyState
              icon="📭"
              title="Nenhuma conta nos próximos 7 dias"
              description="Você está em dia!"
            />
          ) : (
            <ul className="divide-y divide-border">
              {upcoming.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{b.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Vence em {formatDateBR(b.due_date)} ·{" "}
                      {b.type === "payable" ? "A pagar" : "A receber"}
                    </p>
                  </div>
                  <span
                    className={`font-semibold ${b.type === "payable" ? "text-rose-500" : "text-emerald-600"}`}
                  >
                    {formatBRL(b.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Recent transactions */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Últimas transações</CardTitle>
        </CardHeader>
        <CardContent>
          {txQ.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : recentTx.length === 0 ? (
            <EmptyState
              icon="💸"
              title="Nenhuma movimentação ainda"
              actionLabel="+ Adicionar transação"
              onAction={() => { setEditingTx(null); setOpenTx(true); }}
            />
          ) : (
            <ul className="divide-y divide-border">
              {recentTx.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {t.description || t.category}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateBR(t.date)} · {t.category}
                    </p>
                  </div>
                  <span
                    className={`font-semibold ${t.type === "income" ? "text-emerald-600" : "text-rose-500"}`}
                  >
                    {t.type === "income" ? "+" : "-"} {formatBRL(Number(t.amount))}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingTx({
                          id: t.id,
                          type: t.type === "income" ? "income" : "expense",
                          amount: t.amount,
                          category: t.category,
                          description: t.description,
                          date: t.date,
                        });
                        setOpenTx(true);
                      }}
                      className="rounded-lg text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => delM.mutate(t.id)}
                      className="rounded-lg text-muted-foreground hover:text-rose-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <TransactionDialog
        open={openTx}
        onOpenChange={(o) => { setOpenTx(o); if (!o) setEditingTx(null); }}
        initial={editingTx}
      />
      <BillDialog open={openBill} onOpenChange={setOpenBill} />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
  sub,
  loading,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: string;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
          {icon}
        </div>
        {loading ? (
          <Skeleton className="mt-3 h-7 w-24" />
        ) : (
          <>
            <p className={`mt-2 text-xl font-bold md:text-2xl ${tone ?? ""}`}>{value}</p>
            {sub && <p className={`mt-0.5 text-xs font-medium ${tone ?? "text-muted-foreground"}`}>{sub}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}