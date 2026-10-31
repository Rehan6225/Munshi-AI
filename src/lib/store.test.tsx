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
    expect(swiggy(result.current).every((t) => t.category === "Food & Dining" && t.ruleId)).toBe(true);
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
    expect(swiggy(result.current).every((t) => t.category === "Food & Dining" && !t.ruleId)).toBe(true);
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
