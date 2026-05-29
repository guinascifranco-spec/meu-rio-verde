
# FinTrack — Plano de Construção

App de controle financeiro pessoal em português (Brasil), com login Google, dados no Lovable Cloud (Supabase), visual minimalista (branco, cinza suave, verde esmeralda #10B981, Inter, rounded-2xl).

## 1. Backend (Lovable Cloud)

Ativar Lovable Cloud e configurar Google OAuth.

**Tabelas (todas com RLS — usuário só vê os próprios dados):**
- `profiles` — id (FK auth.users), nome, avatar_url, criado em
- `transactions` — id, user_id, tipo (income/expense), valor, categoria, descrição, data
- `bills` — id, user_id, descrição, valor, vencimento, tipo (payable/receivable), status (pending/paid), recorrente
- `goals` — id, user_id, nome, valor_alvo, prazo, emoji
- `goal_contributions` — id, goal_id, user_id, valor, data
- `credit_cards` — id, user_id, nome, limite, dia_fechamento, dia_vencimento, cor, bandeira
- `card_purchases` — id, card_id, user_id, descrição, valor, data, categoria, parcelas, parcela_atual

Trigger auto-criação de profile no signup. Policies `auth.uid() = user_id` em todas as tabelas.

## 2. Frontend — Rotas

```
/login                            público — botão "Entrar com Google"
/_authenticated/                  layout protegido + sidebar/topnav
  ├ /                             Dashboard
  ├ /metas                        Goals
  ├ /contas                       Bills
  ├ /cartoes                      Credit Cards
  ├ /cartoes/$id                  Detalhe da fatura
  └ /relatorios                   Reports
```

## 3. Páginas

**Dashboard** — 4 cards (receitas, despesas, saldo, taxa poupança %), gráfico de linha (saldo últimos 6 meses), donut (despesas por categoria), lista próximas contas 7 dias, botões "+ Transação" e "+ Conta".

**Metas** — grid de cards com emoji, barra de progresso, status (Em andamento/Concluída/Atrasada), modal nova meta, modal aporte.

**Contas** — tabela com filtros (status, tipo, mês), vencidas em vermelho, botão "Marcar como paga" com confirmação, modal nova conta.

**Cartões** — lista de cartões (cor/bandeira), por cartão: fatura atual, barra limite usado/disponível, próximas datas. Página de detalhe lista compras do ciclo, modal nova compra com parcelas 1–24x (gera N registros).

**Relatórios** — seletor de mês, gráfico de barras receitas vs despesas (12 meses), tabela despesas por categoria com %, botão exportar PDF (window.print com layout impressão).

## 4. Componentes compartilhados
- `AppShell` (sidebar desktop / bottom-nav mobile)
- `MoneyInput`, `CurrencyDisplay` (R$ 0.000,00)
- `DateDisplay` (dd/MM/yyyy via date-fns/pt-BR)
- `EmptyState`, `LoadingSkeleton`
- Toasts via sonner
- Modais shadcn Dialog para criar/editar

## 5. Detalhes técnicos

- Stack: TanStack Start (já no template) + React + TS + Tailwind + shadcn + Recharts + date-fns
- Acesso a dados: `createServerFn` com `requireSupabaseAuth` + TanStack Query (`ensureQueryData` + `useSuspenseQuery`)
- Mutations invalidam queries relevantes; toast em todo create/update/delete
- Sign-in Google via broker Lovable + `configure_social_auth(["google"])`
- Layout `_authenticated` com `beforeLoad` checando sessão
- Tokens de design em `src/styles.css` (verde esmeralda como `--primary`, fundo branco, radius 1rem)
- Fonte Inter via Google Fonts no `__root.tsx`

## 6. Ordem de implementação
1. Ativar Cloud, criar migrations (tabelas + RLS + trigger profile)
2. Configurar Google auth + tokens de design + Inter
3. AppShell + rota `/login` + `_authenticated`
4. Server functions + hooks por entidade
5. Dashboard
6. Metas, Contas, Cartões, Relatórios
7. Empty states, skeletons, polish responsivo

---

**Pergunta rápida antes de começar:** quer que eu inclua **categorias customizáveis** pelo usuário (CRUD próprio de categorias) ou uso uma **lista fixa pré-definida** (Alimentação, Transporte, Moradia, Lazer, Saúde, Educação, Outros)? A lista fixa é mais rápida e suficiente pra maioria dos casos.
