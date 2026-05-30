import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============ Transactions ============
export const listTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("transactions")
      .select("*")
      .order("date", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        type: z.enum(["income", "expense"]),
        amount: z.number().positive(),
        category: z.string().min(1),
        description: z.string().optional().nullable(),
        date: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("transactions").insert({
      ...data,
      user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("transactions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        type: z.enum(["income", "expense"]),
        amount: z.number().positive(),
        category: z.string().min(1),
        description: z.string().optional().nullable(),
        date: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase
      .from("transactions")
      .update(patch)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Bills ============
export const listBills = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("bills")
      .select("*")
      .order("due_date", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        description: z.string().min(1),
        amount: z.number().positive(),
        due_date: z.string(),
        type: z.enum(["payable", "receivable"]),
        recurring: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("bills")
      .insert({ ...data, user_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const togglePaidBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), paid: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("bills")
      .update({
        status: data.paid ? "paid" : "pending",
        paid_at: data.paid ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("bills").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        description: z.string().min(1),
        amount: z.number().positive(),
        due_date: z.string(),
        type: z.enum(["payable", "receivable"]),
        recurring: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("bills").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Goals ============
export const listGoals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: goals, error } = await context.supabase
      .from("goals")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: contribs, error: e2 } = await context.supabase
      .from("goal_contributions")
      .select("goal_id, amount");
    if (e2) throw new Error(e2.message);
    const sums = new Map<string, number>();
    (contribs ?? []).forEach((c: { goal_id: string; amount: number | string }) => {
      sums.set(c.goal_id, (sums.get(c.goal_id) ?? 0) + Number(c.amount));
    });
    return (goals ?? []).map((g) => ({ ...g, saved: sums.get(g.id) ?? 0 }));
  });

export const createGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().min(1),
        target_amount: z.number().positive(),
        deadline: z.string().nullable().optional(),
        emoji: z.string().min(1).default("🎯"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("goals")
      .insert({ ...data, user_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addGoalContribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        goal_id: z.string().uuid(),
        amount: z.number().positive(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("goal_contributions").insert({
      ...data,
      user_id: context.userId,
      date: new Date().toISOString().slice(0, 10),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("goals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1),
        target_amount: z.number().positive(),
        deadline: z.string().nullable().optional(),
        emoji: z.string().min(1).default("🎯"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("goals").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Cards ============
export const listCards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: cards, error } = await context.supabase
      .from("credit_cards")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: purchases, error: e2 } = await context.supabase
      .from("card_purchases")
      .select("card_id, amount, date");
    if (e2) throw new Error(e2.message);

    // Sum current cycle (simplified: current month)
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const sums = new Map<string, number>();
    (purchases ?? []).forEach((p: { card_id: string; amount: number | string; date: string }) => {
      if (p.date >= start) {
        sums.set(p.card_id, (sums.get(p.card_id) ?? 0) + Number(p.amount));
      }
    });
    const totalUsed = new Map<string, number>();
    (purchases ?? []).forEach((p: { card_id: string; amount: number | string }) => {
      totalUsed.set(p.card_id, (totalUsed.get(p.card_id) ?? 0) + Number(p.amount));
    });
    return (cards ?? []).map((c) => ({
      ...c,
      current_invoice: sums.get(c.id) ?? 0,
      total_used: totalUsed.get(c.id) ?? 0,
    }));
  });

export const createCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().min(1),
        credit_limit: z.number().positive(),
        closing_day: z.number().int().min(1).max(31),
        due_day: z.number().int().min(1).max(31),
        color: z.string().default("#10B981"),
        brand: z.string().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("credit_cards")
      .insert({ ...data, user_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("credit_cards").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1),
        credit_limit: z.number().positive(),
        closing_day: z.number().int().min(1).max(31),
        due_day: z.number().int().min(1).max(31),
        color: z.string().default("#10B981"),
        brand: z.string().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase
      .from("credit_cards")
      .update(patch)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getCardWithPurchases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: card, error: ce }, { data: purchases, error: pe }] = await Promise.all([
      context.supabase.from("credit_cards").select("*").eq("id", data.id).maybeSingle(),
      context.supabase
        .from("card_purchases")
        .select("*")
        .eq("card_id", data.id)
        .order("date", { ascending: false }),
    ]);
    if (ce) throw new Error(ce.message);
    if (pe) throw new Error(pe.message);
    return { card, purchases: purchases ?? [] };
  });

export const createCardPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        card_id: z.string().uuid(),
        description: z.string().min(1),
        amount: z.number().positive(),
        date: z.string(),
        category: z.string().default("Outros"),
        installments: z.number().int().min(1).max(24).default(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const installmentAmount = Number((data.amount / data.installments).toFixed(2));
    const baseDate = new Date(data.date);
    const groupId = crypto.randomUUID();
    const rows = Array.from({ length: data.installments }).map((_, i) => {
      const d = new Date(baseDate);
      d.setMonth(d.getMonth() + i);
      return {
        card_id: data.card_id,
        user_id: context.userId,
        description:
          data.installments > 1
            ? `${data.description} (${i + 1}/${data.installments})`
            : data.description,
        amount: installmentAmount,
        date: d.toISOString().slice(0, 10),
        category: data.category,
        installments: data.installments,
        installment_number: i + 1,
        group_id: groupId,
      };
    });
    const { error } = await context.supabase.from("card_purchases").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCardPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("card_purchases").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });