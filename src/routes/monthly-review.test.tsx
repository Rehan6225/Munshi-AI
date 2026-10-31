import { act, render, screen } from "@testing-library/react";
import { useEffect, type ComponentType } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { Route } from "./monthly-review";
import { StoreProvider, useStore } from "@/lib/store";

const Review = Route.options.component as ComponentType;

function WithDemo() {
  const { hydrated, mode, loadDemo } = useStore();
  useEffect(() => {
    if (hydrated && !mode) loadDemo();
  }, [hydrated, mode, loadDemo]);
  return hydrated && mode ? <Review /> : null;
}

describe("Monthly Review", () => {
  beforeEach(() => localStorage.clear());

  it("renders the demo's report with the eating-out trend worked out from transactions", async () => {
    render(
      <StoreProvider>
        <WithDemo />
      </StoreProvider>,
    );
    await act(() => new Promise((r) => setTimeout(r, 500)));
    expect(screen.getByText("Where your money went")).toBeInTheDocument();
    expect(screen.getByText(/Eating out is trending up/)).toBeInTheDocument();
  });
});
