import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useRef } from "react";
import { toast } from "sonner";
import Papa from "papaparse";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import {
  listInvestments,
  createInvestment,
  updateInvestment,
  deleteInvestment,
  listInvestmentTransactions,
  createInvestmentTransaction,
  bulkCreateInvestments,
} from "@/lib/api/fintrack.functions";
import { formatBRL, formatDateBR } from "@/lib/format";
import { Plus, Upload, TrendingUp, TrendingDown, Wallet, Layers, Pencil, Trash2, History, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_app/investimentos")({
  head: () => ({ meta: [{ title: "Investimentos — MonetaRio" }] }),
  component: Investimentos,
});

// ── Types ──────────────────────────────────────────────────────────────────
type InvestmentType = "renda_fixa" | "acoes_fiis" | "fundos" | "cripto" | "previdencia";

interface Investment {
  id: string;
  name: string;
  type: InvestmentType;
  institution: string;
  invested_amount: number;
  current_value: number;
  purchase_date: string;
  maturity_date?: string | null;
  notes?: string | null;
  created_at: string;
}

// ── Constants ──────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<InvestmentType, string> = {
  renda_fixa: "Renda Fixa",
  acoes_fiis: "Ações/FIIs",
  fundos: "Fundos",
  cripto: "Cripto",
  previdencia: "Previdência",
};

const TYPE_COLORS: Record<InvestmentType, string> = {
  renda_fixa: "#10B981",
  acoes_fiis: "#3B82F6",
  fundos: "#8B5CF6",
  cripto: "#F59E0B",
  previdencia: "#EC4899",
};

const TYPE_BADGE_CLASS: Record<InvestmentType, string> = {
  renda_fixa: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  acoes_fiis: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  fundos: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  cripto: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  previdencia: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
};

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "renda_fixa", label: "Renda Fixa" },
  { value: "acoes_fiis", label: "Ações/FIIs" },
  { value: "fundos", label: "Fundos" },
  { value: "cripto", label: "Cripto" },
  { value: "previdencia", label: "Previdência" },
];

// ── Helpers ────────────────────────────────────────────────────────────────
function gain(inv: Investment) {
  return Number(inv.current_value) - Number(inv.invested_amount);
}

function gainPct(inv: Investment) {
  const invested = Number(inv.invested_amount);
  if (invested === 0) return 0;
  return (gain(inv) / invested) * 100;
}

// ── Main Component ─────────────────────────────────────────────────────────
function Investimentos() {
  const listFn = useServerFn(listInvestments);
  const createFn = useServerFn(createInvestment);
  const updateFn = useServerFn(updateInvestment);
  const deleteFn = useServerFn(deleteInvestment);
  const listTxFn = useServerFn(listInvestmentTransactions);
  const createTxFn = useServerFn(createInvestmentTransaction);
  const bulkFn = useServerFn(bulkCreateInvestments);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["investments"], queryFn: () => listFn() });
  const investments = (q.data ?? []) as Investment[];

  const [filter, setFilter] = useState<string>("all");
  const [openNew, setOpenNew] = useState(false);
  const [editingInv, setEditingInv] = useState<Investment | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [txInvestment, setTxInvestment] = useState<Investment | null>(null);
  const [historyInvestment, setHistoryInvestment] = useState<Investment | null>(null);
  const [openCsv, setOpenCsv] = useState(false);

  const filtered = useMemo(() => {
    if (filter === "all") return investments;
    return investments.filter((i) => i.type === filter);
  }, [investments, filter]);

  // Summary stats
  const stats = useMemo(() => {
    const totalInvested = investments.reduce((s, i) => s + Number(i.invested_amount), 0);
    const totalCurrent = investments.reduce((s, i) => s + Number(i.current_value), 0);
    const totalGain = totalCurrent - totalInvested;
    const totalGainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
    return { totalInvested, totalCurrent, totalGain, totalGainPct, count: investments.length };
  }, [investments]);

  // Donut data
  const pieData = useMemo(() => {
    const map = new Map<InvestmentType, number>();
    investments.forEach((i) => {
      const cur = Number(i.current_value);
      map.set(i.type, (map.get(i.type) ?? 0) + cur);
    });
    return Array.from(map, ([type, value]) => ({
      name: TYPE_LABELS[type],
      value,
      color: TYPE_COLORS[type],
    })).sort((a, b) => b.value - a.value);
  }, [investments]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["investments"] });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Investimento removido"); invalidate(); setConfirmDeleteId(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Investimentos</h1>
          <p className="text-sm text-muted-foreground">Acompanhe sua carteira de investimentos</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => setOpenCsv(true)}
          >
            <Upload className="mr-1 h-4 w-4" />
            Importar CSV
          </Button>
          <Button
            className="rounded-xl"
            onClick={() => { setEditingInv(null); setOpenNew(true); }}
          >
            <Plus className="mr-1 h-4 w-4" />
            Novo investimento
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard
          label="Total investido"
          value={formatBRL(stats.totalCurrent)}
          icon={<Wallet className="h-4 w-4" />}
          loading={q.isLoading}
        />
        <SummaryCard
          label="Rentabilidade R$"
          value={formatBRL(stats.totalGain)}
          icon={stats.totalGain >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          tone={stats.totalGain >= 0 ? "text-emerald-600" : "text-rose-500"}
          loading={q.isLoading}
        />
        <SummaryCard
          label="Rentabilidade %"
          value={`${stats.totalGainPct >= 0 ? "+" : ""}${stats.totalGainPct.toFixed(2)}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          tone={stats.totalGainPct >= 0 ? "text-emerald-600" : "text-rose-500"}
          loading={q.isLoading}
        />
        <SummaryCard
          label="Ativos cadastrados"
          value={String(stats.count)}
          icon={<Layers className="h-4 w-4" />}
          loading={q.isLoading}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      {q.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : investments.length === 0 ? (
        <EmptyState
          icon="📈"
          title="Você ainda não registrou nenhum investimento."
          description="Adicione manualmente ou importe via CSV da sua corretora."
          actionLabel="Novo investimento"
          onAction={() => { setEditingInv(null); setOpenNew(true); }}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Investment list */}
          <div className="space-y-3 lg:col-span-2">
            {filtered.length === 0 ? (
              <EmptyState
                icon="🔍"
                title="Nenhum investimento nesta categoria"
                description="Tente outro filtro."
              />
            ) : (
              filtered.map((inv) => {
                const g = gain(inv);
                const pct = gainPct(inv);
                return (
                  <Card key={inv.id} className="rounded-2xl">
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{inv.name}</p>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE_CLASS[inv.type]}`}
                            >
                              {TYPE_LABELS[inv.type]}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {inv.institution} · Comprado em {formatDateBR(inv.purchase_date)}
                            {inv.maturity_date ? ` · Vence em ${formatDateBR(inv.maturity_date)}` : ""}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-4 text-sm">
                            <span className="text-muted-foreground">
                              Investido:{" "}
                              <span className="font-medium text-foreground">
                                {formatBRL(inv.invested_amount)}
                              </span>
                            </span>
                            <span className="text-muted-foreground">
                              Atual:{" "}
                              <span className="font-semibold text-foreground">
                                {formatBRL(inv.current_value)}
                              </span>
                            </span>
                            <span className={g >= 0 ? "text-emerald-600 font-semibold" : "text-rose-500 font-semibold"}>
                              {g >= 0 ? "+" : ""}{formatBRL(g)} ({pct >= 0 ? "+" : ""}{pct.toFixed(2)}%)
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg text-xs"
                            onClick={() => setTxInvestment(inv)}
                          >
                            <ArrowDownCircle className="mr-1 h-3.5 w-3.5" />
                            Movimentação
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-lg text-muted-foreground"
                            onClick={() => setHistoryInvestment(inv)}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-lg text-muted-foreground hover:text-foreground"
                            onClick={() => { setEditingInv(inv); setOpenNew(true); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-lg text-muted-foreground hover:text-rose-500"
                            onClick={() => setConfirmDeleteId(inv.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Donut chart */}
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Alocação por categoria</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length === 0 ? (
                <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                  Dados insuficientes para exibir o gráfico
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatBRL(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="mt-2 space-y-1.5">
                    {pieData.map((entry) => {
                      const total = pieData.reduce((s, d) => s + d.value, 0);
                      const pct = total > 0 ? (entry.value / total) * 100 : 0;
                      return (
                        <li key={entry.name} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ background: entry.color }}
                            />
                            {entry.name}
                          </span>
                          <span className="text-muted-foreground">
                            {pct.toFixed(1)}% · {formatBRL(entry.value)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modals */}
      <InvestmentDialog
        open={openNew}
        onOpenChange={(o) => { setOpenNew(o); if (!o) setEditingInv(null); }}
        initial={editingInv}
        onCreate={(d) => createFn({ data: d }).then(() => { toast.success("Investimento criado!"); invalidate(); setOpenNew(false); })}
        onUpdate={(id, d) => updateFn({ data: { id, ...d } }).then(() => { toast.success("Investimento atualizado!"); invalidate(); setOpenNew(false); setEditingInv(null); })}
      />

      {txInvestment && (
        <TransactionModal
          investment={txInvestment}
          open={!!txInvestment}
          onOpenChange={(o) => { if (!o) setTxInvestment(null); }}
          onConfirm={(d) =>
            createTxFn({ data: d }).then(() => {
              toast.success("Movimentação registrada!");
              invalidate();
              setTxInvestment(null);
            })
          }
        />
      )}

      {historyInvestment && (
        <HistoryDrawer
          investment={historyInvestment}
          open={!!historyInvestment}
          onClose={() => setHistoryInvestment(null)}
          listTxFn={listTxFn}
        />
      )}

      <CsvImportModal
        open={openCsv}
        onOpenChange={setOpenCsv}
        onImport={(rows) =>
          bulkFn({ data: { rows } }).then((r) => {
            toast.success(`${r.count} investimento(s) importado(s) com sucesso!`);
            invalidate();
            setOpenCsv(false);
          })
        }
      />

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover investimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O histórico de movimentações também será apagado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-rose-500 hover:bg-rose-600"
              onClick={() => confirmDeleteId && deleteM.mutate(confirmDeleteId)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

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

// ── Investment Dialog ──────────────────────────────────────────────────────

type InvForm = {
  name: string;
  type: InvestmentType;
  institution: string;
  invested_amount: string;
  current_value: string;
  purchase_date: string;
  maturity_date: string;
  notes: string;
};

const emptyForm: InvForm = {
  name: "",
  type: "renda_fixa",
  institution: "",
  invested_amount: "",
  current_value: "",
  purchase_date: new Date().toISOString().slice(0, 10),
  maturity_date: "",
  notes: "",
};

function InvestmentDialog({
  open,
  onOpenChange,
  initial,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: Investment | null;
  onCreate: (d: Omit<InvForm, "invested_amount" | "current_value"> & { invested_amount: number; current_value: number }) => Promise<void>;
  onUpdate: (id: string, d: Omit<InvForm, "invested_amount" | "current_value"> & { invested_amount: number; current_value: number }) => Promise<void>;
}) {
  const [form, setForm] = useState<InvForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Sync form when dialog opens / initial changes
  useState(() => {
    if (open) {
      setForm(
        initial
          ? {
              name: initial.name,
              type: initial.type,
              institution: initial.institution,
              invested_amount: String(initial.invested_amount),
              current_value: String(initial.current_value),
              purchase_date: initial.purchase_date,
              maturity_date: initial.maturity_date ?? "",
              notes: initial.notes ?? "",
            }
          : emptyForm,
      );
    }
  });

  // Reset on open change
  const handleOpen = (o: boolean) => {
    if (o && initial) {
      setForm({
        name: initial.name,
        type: initial.type,
        institution: initial.institution,
        invested_amount: String(initial.invested_amount),
        current_value: String(initial.current_value),
        purchase_date: initial.purchase_date,
        maturity_date: initial.maturity_date ?? "",
        notes: initial.notes ?? "",
      });
    } else if (o) {
      setForm(emptyForm);
    }
    onOpenChange(o);
  };

  const set = (k: keyof InvForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.name || !form.institution || !form.invested_amount || !form.current_value || !form.purchase_date) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        type: form.type,
        institution: form.institution,
        invested_amount: Number(form.invested_amount),
        current_value: Number(form.current_value),
        purchase_date: form.purchase_date,
        maturity_date: form.maturity_date || null,
        notes: form.notes || null,
      };
      if (initial) {
        await onUpdate(initial.id, payload);
      } else {
        await onCreate(payload);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar investimento" : "Novo investimento"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="inv-name">Nome do ativo *</Label>
            <Input id="inv-name" placeholder="Ex: Tesouro IPCA+ 2029" value={form.name} onChange={set("name")} className="rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Tipo *</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as InvestmentType }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="renda_fixa">Renda Fixa</SelectItem>
                  <SelectItem value="acoes_fiis">Ações e FIIs</SelectItem>
                  <SelectItem value="fundos">Fundos</SelectItem>
                  <SelectItem value="cripto">Cripto</SelectItem>
                  <SelectItem value="previdencia">Previdência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="inv-inst">Instituição *</Label>
              <Input id="inv-inst" placeholder="XP, Binance, B3..." value={form.institution} onChange={set("institution")} className="rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="inv-invested">Valor investido R$ *</Label>
              <Input id="inv-invested" type="number" min="0" step="0.01" placeholder="0,00" value={form.invested_amount} onChange={set("invested_amount")} className="rounded-xl" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="inv-current">Valor atual R$ *</Label>
              <Input id="inv-current" type="number" min="0" step="0.01" placeholder="0,00" value={form.current_value} onChange={set("current_value")} className="rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="inv-purchase">Data de compra *</Label>
              <Input id="inv-purchase" type="date" value={form.purchase_date} onChange={set("purchase_date")} className="rounded-xl" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="inv-maturity">Data de vencimento</Label>
              <Input id="inv-maturity" type="date" value={form.maturity_date} onChange={set("maturity_date")} className="rounded-xl" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="inv-notes">Observações</Label>
            <Textarea id="inv-notes" placeholder="Notas opcionais..." value={form.notes} onChange={set("notes")} className="rounded-xl" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="rounded-xl" disabled={saving} onClick={handleSubmit}>
            {saving ? "Salvando..." : initial ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Transaction Modal ──────────────────────────────────────────────────────

function TransactionModal({
  investment,
  open,
  onOpenChange,
  onConfirm,
}: {
  investment: Investment;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (d: {
    investment_id: string;
    type: "aporte" | "resgate";
    amount: number;
    date: string;
    new_current_value: number;
    notes: string | null;
  }) => Promise<void>;
}) {
  const [txType, setTxType] = useState<"aporte" | "resgate">("aporte");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [newValue, setNewValue] = useState(String(investment.current_value));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!amount || !date || !newValue) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    setSaving(true);
    try {
      await onConfirm({
        investment_id: investment.id,
        type: txType,
        amount: Number(amount),
        date,
        new_current_value: Number(newValue),
        notes: notes || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar movimentação</DialogTitle>
          <p className="text-sm text-muted-foreground">{investment.name}</p>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {/* Toggle aporte/resgate */}
          <div className="flex rounded-xl border border-border overflow-hidden">
            {(["aporte", "resgate"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTxType(t)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
                  txType === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {t === "aporte" ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
                {t === "aporte" ? "Aporte" : "Resgate"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="tx-amount">Valor R$ *</Label>
              <Input id="tx-amount" type="number" min="0" step="0.01" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-xl" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tx-date">Data *</Label>
              <Input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tx-newvalue">Valor atual após movimentação R$ *</Label>
            <Input id="tx-newvalue" type="number" min="0" step="0.01" value={newValue} onChange={(e) => setNewValue(e.target.value)} className="rounded-xl" />
            <p className="text-xs text-muted-foreground">Atual: {formatBRL(investment.current_value)}</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tx-notes">Observações</Label>
            <Input id="tx-notes" placeholder="Opcional" value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="rounded-xl" disabled={saving} onClick={handleSubmit}>
            {saving ? "Salvando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── History Drawer ─────────────────────────────────────────────────────────

type TxRow = {
  id: string;
  type: "aporte" | "resgate";
  amount: number;
  date: string;
  notes?: string | null;
};

function HistoryDrawer({
  investment,
  open,
  onClose,
  listTxFn,
}: {
  investment: Investment;
  open: boolean;
  onClose: () => void;
  listTxFn: (opts: { data: { investment_id: string } }) => Promise<TxRow[]>;
}) {
  const q = useQuery({
    queryKey: ["inv-tx", investment.id],
    queryFn: () => listTxFn({ data: { investment_id: investment.id } }),
    enabled: open,
  });

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-h-[80vh]">
        <DrawerHeader>
          <DrawerTitle>Histórico — {investment.name}</DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-6">
          {q.isLoading ? (
            <div className="space-y-2 pt-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
            </div>
          ) : (q.data ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
          ) : (
            <ul className="divide-y divide-border">
              {(q.data as TxRow[]).map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      {tx.type === "aporte" ? (
                        <ArrowDownCircle className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <ArrowUpCircle className="h-4 w-4 text-rose-500" />
                      )}
                      <span className="text-sm font-medium capitalize">{tx.type}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDateBR(tx.date)}{tx.notes ? ` · ${tx.notes}` : ""}</p>
                  </div>
                  <span className={`font-semibold ${tx.type === "aporte" ? "text-emerald-600" : "text-rose-500"}`}>
                    {tx.type === "aporte" ? "+" : "-"}{formatBRL(tx.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// ── CSV Import Modal ───────────────────────────────────────────────────────

type CsvRow = {
  name: string;
  type: InvestmentType;
  institution: string;
  invested_amount: number;
  current_value: number;
  purchase_date: string;
};

const CSV_GUIDES = {
  generic: {
    label: "Genérico (padrão MonetaRio)",
    guide: "Baixe o modelo e preencha as colunas: nome, tipo (renda_fixa | acoes_fiis | fundos | cripto | previdencia), instituição, valor_investido, valor_atual, data_compra (YYYY-MM-DD).",
  },
  xp: {
    label: "XP / Rico / Clear (B3)",
    guide: "1. Acesse o Portal B3 ou o app da corretora. 2. Vá em Extrato > Posição. 3. Exporte como CSV. 4. Selecione este formato e faça o upload.",
  },
  binance: {
    label: "Binance",
    guide: "1. Acesse sua conta Binance. 2. Vá em Carteira > Overview > Histórico. 3. Clique em 'Exportar'. 4. Selecione este formato.",
  },
};

function parseCsvRows(
  raw: Record<string, string>[],
  format: keyof typeof CSV_GUIDES,
): CsvRow[] {
  if (format === "generic") {
    return raw
      .map((r) => ({
        name: r["nome"] ?? r["name"] ?? "",
        type: (r["tipo"] ?? r["type"] ?? "renda_fixa") as InvestmentType,
        institution: r["instituição"] ?? r["instituicao"] ?? r["institution"] ?? "",
        invested_amount: Number(r["valor_investido"] ?? r["invested_amount"] ?? 0),
        current_value: Number(r["valor_atual"] ?? r["current_value"] ?? 0),
        purchase_date: r["data_compra"] ?? r["purchase_date"] ?? new Date().toISOString().slice(0, 10),
      }))
      .filter((r) => r.name);
  }
  if (format === "xp") {
    return raw
      .map((r) => ({
        name: r["Ativo"] ?? r["Produto"] ?? r["Papel"] ?? "",
        type: "acoes_fiis" as InvestmentType,
        institution: "XP",
        invested_amount: Number((r["Custo Total"] ?? r["Valor Investido"] ?? "0").replace(/[R$.\s]/g, "").replace(",", ".")),
        current_value: Number((r["Valor Atual"] ?? r["Valor de Mercado"] ?? "0").replace(/[R$.\s]/g, "").replace(",", ".")),
        purchase_date: new Date().toISOString().slice(0, 10),
      }))
      .filter((r) => r.name);
  }
  if (format === "binance") {
    return raw
      .map((r) => ({
        name: r["Coin"] ?? r["Asset"] ?? "",
        type: "cripto" as InvestmentType,
        institution: "Binance",
        invested_amount: Number(r["Total Cost"] ?? r["Amount"] ?? 0),
        current_value: Number(r["Current Value"] ?? r["Amount"] ?? 0),
        purchase_date: new Date().toISOString().slice(0, 10),
      }))
      .filter((r) => r.name);
  }
  return [];
}

function CsvImportModal({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImport: (rows: CsvRow[]) => Promise<void>;
}) {
  const [format, setFormat] = useState<keyof typeof CSV_GUIDES>("generic");
  const [preview, setPreview] = useState<CsvRow[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = parseCsvRows(result.data, format);
        setPreview(rows);
        if (rows.length === 0) toast.error("Nenhum dado reconhecido. Verifique o formato selecionado.");
      },
    });
  };

  const handleImport = async () => {
    if (preview.length === 0) return;
    setSaving(true);
    try {
      await onImport(preview);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) { setPreview([]); if (fileRef.current) fileRef.current.value = ""; }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar CSV</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Formato da corretora</Label>
            <Select value={format} onValueChange={(v) => { setFormat(v as keyof typeof CSV_GUIDES); setPreview([]); if (fileRef.current) fileRef.current.value = ""; }}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CSV_GUIDES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">{CSV_GUIDES[format].guide}</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="csv-file">Arquivo CSV</Label>
            <Input
              id="csv-file"
              ref={fileRef}
              type="file"
              accept=".csv"
              className="rounded-xl"
              onChange={handleFile}
            />
          </div>
          {preview.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">{preview.length} registro(s) identificado(s):</p>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Nome</th>
                      <th className="px-3 py-2 text-left font-medium">Tipo</th>
                      <th className="px-3 py-2 text-left font-medium">Inst.</th>
                      <th className="px-3 py-2 text-right font-medium">Investido</th>
                      <th className="px-3 py-2 text-right font-medium">Atual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {preview.slice(0, 10).map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5">{r.name}</td>
                        <td className="px-3 py-1.5">{TYPE_LABELS[r.type]}</td>
                        <td className="px-3 py-1.5">{r.institution}</td>
                        <td className="px-3 py-1.5 text-right">{formatBRL(r.invested_amount)}</td>
                        <td className="px-3 py-1.5 text-right">{formatBRL(r.current_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 10 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">… e mais {preview.length - 10} registros</p>
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button className="rounded-xl" disabled={preview.length === 0 || saving} onClick={handleImport}>
            {saving ? "Importando..." : `Confirmar importação${preview.length > 0 ? ` (${preview.length})` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
