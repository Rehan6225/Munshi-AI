import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { StoreProvider, useStore } from "./store";

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>{children}</StoreProvider>
);

async function demoStore() {
  const hook = renderHook(() => useStore(), { wrapper });
  await waitFor(() => expect(hook.result.current.hydrated).toBe(true));
  act(() => hook.result.current.loadDemo());
  return hook;
}

const swiggy = (s: ReturnType<typeof useStore>) =>
  s.transactions.filter((t) => t.merchant === "Swiggy");

describe("store: correction loop", () => {
  beforeEach(() => localStorage.clear());

  it("suggests fixing the miscategorised Swiggy order in the demo", async () => {
    const { result } = await demoStore();
    const odd = swiggy(result.current).find((t) => t.category === "Groceries")!;
    expect(result.current.suggestions.get(odd.id)).toBe("Food & Dining");
  });

  it("learns a rule, refiles the past and categorises the future", async () => {
    const { result } = await demoStore();
    const orders = swiggy(result.current).length;

    let changed = 0;
    act(() => {
      changed = result.current.learnRule("Swiggy", "Food & Dining");
    });
    expect(changed).toBe(1);
    expect(swiggy(result.current).every((t) => t.category === "Food & Dining" && t.ruleId)).toBe(
      true,
    );
    expect(result.current.suggestions.size).toBe(0);
    expect(result.current.rules).toMatchObject([
      { merchant: "Swiggy", category: "Food & Dining", applied: orders },
    ]);

    // A new spend the parser guessed wrong gets fixed by the rule.
    let added!: ReturnType<typeof result.current.add>;
    act(() => {
      added = result.current.add({
        merchant: "swiggy",
        category: "Groceries",
        amount: 300,
        date: new Date().toISOString(),
      });
    });
    expect(added).toMatchObject({ category: "Food & Dining" });
    expect(added.ruleId).toBeTruthy();
    expect(result.current.rules[0]!.applied).toBe(orders + 1);
  });

  it("forgetting a rule keeps categories but drops the learned badge", async () => {
    const { result } = await demoStore();
    act(() => void result.current.learnRule("Swiggy", "Food & Dining"));
    act(() => result.current.removeRule(result.current.rules[0]!.id));
    expect(result.current.rules).toEqual([]);
    expect(swiggy(result.current).every((t) => t.category === "Food & Dining" && !t.ruleId)).toBe(
      true,
    );
  });

  it("keeps rules and profile across a reload", async () => {
    const first = await demoStore();
    act(() => void first.result.current.learnRule("Uber", "Transport"));
    act(() => first.result.current.updateProfile({ income: 120000 }));
    first.unmount();

    const { result } = renderHook(() => useStore(), { wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.mode).toBe("demo");
    expect(result.current.profile.income).toBe(120000);
    expect(result.current.rules.map((r) => r.merchant)).toEqual(["Uber"]);
  });
});

describe("store: demo and own data stay apart", () => {
  beforeEach(() => localStorage.clear());
  const imported = {
    merchant: "Netflix",
    category: "Subscriptions" as const,
    amount: 649,
    date: new Date().toISOString(),
    source: "pdf" as const,
  };

  it("puts an import made from the demo into the user's own data", async () => {
    const { result } = await demoStore();
    const demoCount = result.current.transactions.length;

    let leftDemo = false;
    act(() => {
      leftDemo = result.current.addMany([imported]);
    });
    expect(leftDemo).toBe(true);
    expect(result.current.mode).toBe("own");
    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.subscriptions.map((s) => s.name)).toEqual(["Netflix"]);

    act(() => result.current.loadDemo());
    expect(result.current.transactions).toHaveLength(demoCount);
    expect(result.current.hasOwnData).toBe(true);
  });

  it("leaving the demo keeps the user's data, clearing it doesn't touch the demo", async () => {
    const { result } = await demoStore();
    act(() => void result.current.addMany([imported]));
    act(() => result.current.loadDemo());
    act(() => result.current.reset());
    expect(result.current.mode).toBe("own");
    expect(result.current.transactions).toHaveLength(1);
    act(() => result.current.reset());
    expect(result.current.mode).toBeNull();
    expect(result.current.hasOwnData).toBe(false);
  });

  it("has no salary for the user's data until they give one; the sample's never overrides it", async () => {
    const { result } = await demoStore();
    expect(result.current.incomeAssumed).toBe(true);
    act(() => void result.current.addMany([imported]));
    expect(result.current.profile.income).toBe(0);

    act(() => result.current.assumeSampleIncome());
    expect([result.current.profile.income, result.current.incomeAssumed]).toEqual([95000, true]);
    act(() => result.current.updateProfile({ income: 72000 }));
    act(() => result.current.assumeSampleIncome());
    expect([result.current.profile.income, result.current.ownIncomeSet]).toEqual([72000, true]);
  });

  it("reads data saved in the older single-set format", async () => {
    localStorage.setItem(
      "munshi-ai:v1",
      JSON.stringify({ mode: "own", transactions: [{ id: "x", ...imported, category: "Food" }] }),
    );
    const { result } = renderHook(() => useStore(), { wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.mode).toBe("own");
    expect(result.current.transactions[0]!.category).toBe("Food & Dining");
  });
});
