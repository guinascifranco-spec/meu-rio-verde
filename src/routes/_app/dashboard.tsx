import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  listTransactions,
  listBills,
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
import { Plus, TrendingUp, TrendingDown, Wallet, PiggyBank } from "lucide-react";
import { TransactionDialog } from "@/components/dialogs/transaction-dialog";
import { BillDialog } from "@/components/dialogs/bill-dialog";
import { EmptyState } from "@/components/empty-state";
import { addDays, startOfMonth, subMonths, format, parseISO } from "date-fns";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — FinTrack" }],
  }),
  component: Dashboard,
});

const PIE_COLORS = ["#10B981", "#34D399", "#6EE7B7", "#A7F3D0", "#FBBF24", "#F97316", "#EF4444", "#8B5CF6", "#3B82F6", "#94A3B8"];

function Dashboard() {
  const [openTx, setOpenTx] = useState(false);
  const [openBill, setOpenBill] = useState(false);
  const listTx = useServerFn(listTransactions);
  const listB = useServerFn(listBills);

  const txQ = useQuery({ queryKey: ["transactions"], queryFn: () => listTx() });
  const billsQ = useQuery({ queryKey: ["bills"], queryFn: () => listB() });

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Olá 👋</h1>
          <p className="text-sm text-muted-foreground">Resumo de {format(now, "MMMM 'de' yyyy")}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setOpenTx(true)} className="rounded-xl">
            <Plus className="mr-1 h-4 w-4" /> Transação
          </Button>
          <Button onClick={() => setOpenBill(true)} variant="outline" className="rounded-xl">
            <Plus className="mr-1 h-4 w-4" /> Conta
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard
          label="Receitas"
          value={formatBRL(monthly.income)}
          icon={<TrendingUp className="h-4 w-4" />}
          tone="text-emerald-600"
          loading={txQ.isLoading}
        />
        <SummaryCard
          label="Despesas"
          value={formatBRL(monthly.expense)}
          icon={<TrendingDown className="h-4 w-4" />}
          tone="text-rose-500"
          loading={txQ.isLoading}
        />
        <SummaryCard
          label="Saldo"
          value={formatBRL(monthly.balance)}
          icon={<Wallet className="h-4 w-4" />}
          loading={txQ.isLoading}
        />
        <SummaryCard
          label="Taxa poupança"
          value={`${monthly.savings.toFixed(0)}%`}
          icon={<PiggyBank className="h-4 w-4" />}
          loading={txQ.isLoading}
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
                Sem despesas neste mês
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

      <TransactionDialog open={openTx} onOpenChange={setOpenTx} />
      <BillDialog open={openBill} onOpenChange={setOpenBill} />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
  loading,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: string;
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
          <p className={`mt-2 text-xl font-bold md:text-2xl ${tone ?? ""}`}>{value}</p>
        )}
      </CardContent>
    </Card>
  );
}