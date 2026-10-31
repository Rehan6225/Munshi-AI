import { beforeEach, describe, expect, it } from "vitest";
import { act, render } from "@testing-library/react";
import { StoreProvider, useStore } from "./store";

let store: ReturnType<typeof useStore>;
function Grab() {
  store = useStore();
  return null;
}
const mount = async () => {
  const view = render(
    <StoreProvider>
      <Grab />
    </StoreProvider>,
  );
  await act(() => new Promise((r) => setTimeout(r, 500)));
  return view;
};
const imported = {
  merchant: "Netflix",
  category: "Entertainment" as const,
  amount: 649,
  date: new Date().toISOString(),
  source: "pdf" as const,
};

beforeEach(() => localStorage.clear());

describe("demo and own data", () => {
  it("keeps an import out of the demo and switches to the user's data", async () => {
    await mount();
    act(() => store.loadDemo());
    const demoCount = store.transactions.length;
    expect(store.mode).toBe("demo");

    let leftDemo = false;
    act(() => {
      leftDemo = store.addMany([imported]);
    });
    expect(leftDemo).toBe(true);
    expect(store.mode).toBe("mine");
    expect(store.transactions).toHaveLength(1);
    expect(store.subscriptions.map((s) => s.name)).toEqual(["Netflix"]);

    act(() => store.loadDemo());
    expect(store.transactions).toHaveLength(demoCount);
    expect(store.hasOwnData).toBe(true);
  });

  it("saves only the user's own data, and reopens on it", async () => {
    const first = await mount();
    act(() => store.loadDemo());
    act(() => void store.addMany([imported]));
    first.unmount();

    await mount();
    expect(store.mode).toBe("mine");
    expect(store.transactions.map((t) => t.merchant)).toEqual(["Netflix"]);
  });

  it("drops demo rows that older versions saved alongside the user's", async () => {
    localStorage.setItem(
      "munshi-ai-data",
      JSON.stringify({
        transactions: [
          {
            id: "1",
            merchant: "Swiggy",
            category: "Food",
            amount: 640,
            date: new Date().toISOString(),
          },
          { id: "abc-123", ...imported },
        ],
        goals: [{ id: "g1", name: "Emergency fund", saved: 1, target: 2, due: "Mar 2027" }],
      }),
    );
    localStorage.setItem("munshi-ai-demo", "1");
    await mount();
    expect(store.mode).toBe("demo");
    act(() => store.showMine());
    expect(store.transactions.map((t) => t.id)).toEqual(["abc-123"]);
    expect(store.goals).toEqual([]);
  });

  it("exiting the demo leaves the user's data alone", async () => {
    await mount();
    act(() => void store.addMany([imported]));
    act(() => store.loadDemo());
    act(() => store.reset());
    expect(store.mode).toBe("mine");
    expect(store.transactions).toHaveLength(1);
  });

  it("has no income for the user's own data until they give it", async () => {
    await mount();
    act(() => void store.addMany([imported]));
    expect(store.income).toBeNull();
    act(() => store.loadDemo());
    expect([store.income, store.incomeAssumed]).toEqual([95000, true]);
  });

  it("uses the sample salary only until the user gives their own", async () => {
    await mount();
    act(() => void store.addMany([imported]));
    act(() => store.assumeSampleIncome());
    expect([store.income, store.incomeAssumed]).toEqual([95000, true]);
    act(() => store.setIncome(72000));
    act(() => store.assumeSampleIncome());
    expect([store.income, store.incomeAssumed, store.ownIncomeSet]).toEqual([72000, false, true]);
  });
});
