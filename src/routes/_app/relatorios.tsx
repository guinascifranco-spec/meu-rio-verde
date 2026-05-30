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
import { listTransactions } from "@/lib/api/fintrack.functions";
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
  const q = useQuery({ queryKey: ["transactions"], queryFn: () => list() });

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
    </div>
  );
}