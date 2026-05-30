import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { listTransactions, listInvestments } from "@/lib/api/fintrack.functions";
import { formatBRL } from "@/lib/format";
import { format, parseISO, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/_app/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — MonetaRio" }] }),
  component: Relatorios,
});

function Relatorios() {
  const list = useServerFn(listTransactions);
  const listInv = useServerFn(listInvestments);
  const q = useQuery({ queryKey: ["transactions"], queryFn: () => list() });
  const invQ = useQuery({ queryKey: ["investments"], queryFn: () => listInv() });

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const barData = useMemo(() => {
    const txs = q.data ?? [];
    const [yearStr, monthStr] = month.split("-");
    const endDate = new Date(Number(yearStr), Number(monthStr) - 1, 15);
    return Array.from({ length: 12 }).map((_, i) => {
      const d = subMonths(endDate, 11 - i);
      const s = startOfMonth(d);
      const e = startOfMonth(subMonths(endDate, 11 - i - 1));
      const monthTxs = txs.filter((t) => {
        const td = parseISO(t.date);
        return td >= s && td < e;
      });
      const receita = monthTxs.filter((t) => t.type === "income").reduce((a, t) => a + Number(t.amount), 0);
      const despesa = monthTxs.filter((t) => t.type === "expense").reduce((a, t) => a + Number(t.amount), 0);
      return { mes: format(d, "MMM/yy", { locale: ptBR }), receita, despesa };
    });
  }, [q.data, month]);

  const hasBarData = useMemo(() => {
    return barData.some((d) => d.receita > 0 || d.despesa > 0);
  }, [barData]);

  const categoryRows = useMemo(() => {
    const txs = (q.data ?? []).filter(
      (t) => t.type === "expense" && t.date.startsWith(month),
    );
    const map = new Map<string, number>();
    txs.forEach((t) => map.set(t.category, (map.get(t.category) ?? 0) + Number(t.amount)));
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    return Array.from(map, ([category, value]) => ({
      category, value, pct: total > 0 ? (value / total) * 100 : 0,
    })).sort((a, b) => b.value - a.value);
  }, [q.data, month]);

  type InvType = "renda_fixa" | "acoes_fiis" | "fundos" | "cripto" | "previdencia";
  const TYPE_LABELS: Record<InvType, string> = {
    renda_fixa: "Renda Fixa", acoes_fiis: "Ações/FIIs", fundos: "Fundos", cripto: "Cripto", previdencia: "Previdência",
  };
  const TYPE_COLORS: Record<InvType, string> = {
    renda_fixa: "#10B981", acoes_fiis: "#3B82F6", fundos: "#8B5CF6", cripto: "#F59E0B", previdencia: "#EC4899",
  };

  // Investment patrimônio evolution (by purchase_date, cumulative current_value per month)
  const invBarData = useMemo(() => {
    const invs = invQ.data ?? [];
    const [yearStr, monthStr] = month.split("-");
    const endDate = new Date(Number(yearStr), Number(monthStr) - 1, 15);
    return Array.from({ length: 12 }).map((_, i) => {
      const d = subMonths(endDate, 11 - i);
      const label = format(d, "MMM/yy", { locale: ptBR });
      const monthEnd = startOfMonth(subMonths(endDate, 11 - i - 1));
      // sum current_value of all investments purchased up to the month boundary
      const patrimonio = invs
        .filter((inv: { purchase_date: string }) => parseISO(inv.purchase_date) < monthEnd)
        .reduce((s: number, inv: { current_value: number }) => s + Number(inv.current_value), 0);
      return { mes: label, patrimonio };
    });
  }, [invQ.data, month]);

  const hasInvBarData = invBarData.some((d) => d.patrimonio > 0);

  // Rentabilidade by type for selected month
  const invTypeRows = useMemo(() => {
    const invs = invQ.data ?? [];
    const map = new Map<InvType, { invested: number; current: number }>();
    invs.forEach((inv: { type: InvType; invested_amount: number; current_value: number }) => {
      const prev = map.get(inv.type) ?? { invested: 0, current: 0 };
      map.set(inv.type, {
        invested: prev.invested + Number(inv.invested_amount),
        current: prev.current + Number(inv.current_value),
      });
    });
    return Array.from(map, ([type, v]) => ({
      type,
      label: TYPE_LABELS[type],
      color: TYPE_COLORS[type],
      invested: v.invested,
      current: v.current,
      gain: v.current - v.invested,
      pct: v.invested > 0 ? ((v.current - v.invested) / v.invested) * 100 : 0,
    })).sort((a, b) => b.current - a.current);
  }, [invQ.data]);

  return (
    <div className="space-y-6 print:space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Análise dos seus gastos</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs text-muted-foreground font-medium mb-1">Selecionar mês:</label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-xl" />
          </div>
          <Button onClick={() => window.print()} variant="outline" className="rounded-xl">
            <Printer className="mr-1 h-4 w-4" /> Exportar PDF
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Receitas vs Despesas (12 meses)</CardTitle></CardHeader>
        <CardContent className="h-80">
          {q.isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : !hasBarData ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Sem dados suficientes para este período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <XAxis dataKey="mes" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `R$ ${v}`} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Legend />
                <Bar dataKey="receita" fill="#10B981" radius={[8, 8, 0, 0]} />
                <Bar dataKey="despesa" fill="#EF4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Despesas por categoria · {month}</CardTitle></CardHeader>
        <CardContent>
          {categoryRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sem despesas neste mês</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2">Categoria</th>
                  <th className="pb-2 text-right">Valor</th>
                  <th className="pb-2 text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categoryRows.map((r) => (
                  <tr key={r.category}>
                    <td className="py-2 font-medium">{r.category}</td>
                    <td className="py-2 text-right">{formatBRL(r.value)}</td>
                    <td className="py-2 text-right text-muted-foreground">{r.pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Investments section */}
      <div className="pt-2">
        <h2 className="mb-4 text-lg font-semibold">Investimentos</h2>
      </div>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Evolução do patrimônio investido (12 meses)</CardTitle></CardHeader>
        <CardContent className="h-80">
          {invQ.isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : !hasInvBarData ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Sem dados de investimentos para este período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={invBarData}>
                <XAxis dataKey="mes" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `R$ ${v}`} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Legend />
                <Bar dataKey="patrimonio" name="Patrimônio" fill="#10B981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Rentabilidade por tipo · Carteira atual</CardTitle></CardHeader>
        <CardContent>
          {invTypeRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum investimento cadastrado</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2">Tipo</th>
                  <th className="pb-2 text-right">Investido</th>
                  <th className="pb-2 text-right">Atual</th>
                  <th className="pb-2 text-right">Ganho R$</th>
                  <th className="pb-2 text-right">Ganho %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invTypeRows.map((r) => (
                  <tr key={r.type}>
                    <td className="py-2">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />
                        <span className="font-medium">{r.label}</span>
                      </span>
                    </td>
                    <td className="py-2 text-right">{formatBRL(r.invested)}</td>
                    <td className="py-2 text-right">{formatBRL(r.current)}</td>
                    <td className={`py-2 text-right font-medium ${r.gain >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                      {r.gain >= 0 ? "+" : ""}{formatBRL(r.gain)}
                    </td>
                    <td className={`py-2 text-right font-medium ${r.pct >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                      {r.pct >= 0 ? "+" : ""}{r.pct.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}