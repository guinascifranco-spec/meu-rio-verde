## Objetivo

Permitir editar qualquer lançamento já criado: transações, contas a pagar/receber, metas, cartões e compras de cartão.

## Backend (server functions em `src/lib/api/fintrack.functions.ts`)

Adicionar uma função `update*` para cada entidade, com o mesmo schema Zod do `create*` + `id`, usando `requireSupabaseAuth` e `supabase.from(...).update(...).eq("id", id)`:

- `updateTransaction` — type, amount, category, description, date
- `updateBill` — description, amount, due_date, type, recurring
- `updateGoal` — name, target_amount, deadline, emoji
- `updateCard` — name, credit_limit, closing_day, due_day, color, brand
- `updateCardPurchase` — description, amount, date, category (sem mexer em parcelas; editar uma parcela altera só aquela linha; aviso na UI)

RLS atual (`auth.uid() = user_id`) já cobre updates. Sem migrações.

## Frontend

Estratégia: reaproveitar os dialogs existentes adicionando um modo "editar". O dialog passa a aceitar `initial?: Entity | null`; quando presente, pré-preenche campos, muda título para "Editar X" e chama a função `update*` em vez da `create*`.

Componentes a atualizar:

- `src/components/dialogs/transaction-dialog.tsx` — aceitar `initial`, criar/atualizar conforme presença.
- `src/components/dialogs/bill-dialog.tsx` — idem.
- `src/routes/_app/metas.tsx` — converter o `Dialog` inline de nova meta em criar/editar (mesmo state, prop `editing`).
- `src/routes/_app/cartoes.index.tsx` — idem para cartões.
- `src/routes/_app/cartoes.$id.tsx` — idem para compras.

Em cada lista (dashboard recentes? não há lista de transações hoje — ver abaixo), contas, metas, cartões e compras, adicionar botão de lápis (`Pencil` do lucide-react) ao lado do botão de excluir que abre o dialog em modo edição.

### Lista de transações

Atualmente não existe uma página listando transações individualmente para editar. Duas opções:

1. **Adicionar uma seção "Últimas transações" no Dashboard** com ações editar/excluir por linha (mínimo viável, sem nova rota).
2. Criar rota `/transacoes` dedicada.

Plano adota opção 1 (menor escopo, mantém navegação atual). Caso prefira rota dedicada, ajusto.

### UX

- Toast: "X atualizada" no sucesso.
- Invalidar as mesmas query keys do create correspondente.
- Confirmação de edição não é necessária (apenas para marcar conta como paga, que já existe).

## Resumo de arquivos

- `src/lib/api/fintrack.functions.ts` — +5 funções update.
- `src/components/dialogs/transaction-dialog.tsx` — modo edição.
- `src/components/dialogs/bill-dialog.tsx` — modo edição.
- `src/routes/_app/dashboard.tsx` — nova seção "Últimas transações" com editar/excluir.
- `src/routes/_app/contas.tsx` — botão editar em cada linha.
- `src/routes/_app/metas.tsx` — dialog em modo criar/editar + botão editar.
- `src/routes/_app/cartoes.index.tsx` — dialog em modo criar/editar + botão editar.
- `src/routes/_app/cartoes.$id.tsx` — dialog em modo criar/editar + botão editar por compra.
