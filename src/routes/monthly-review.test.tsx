import { act, fireEvent, render, screen } from "@testing-library/react";
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

  it("renders a report card from the demo and switches months", async () => {
    render(
      <StoreProvider>
        <WithDemo />
      </StoreProvider>,
    );
    await act(() => new Promise((r) => setTimeout(r, 500)));
    expect(screen.getByText("Wins")).toBeInTheDocument();
    expect(screen.getByText("Where it went")).toBeInTheDocument();
    expect(screen.getByText(/Food & Dining rose/)).toBeInTheDocument();

    const picker = screen.getByLabelText("Month") as HTMLSelectElement;
    const earlier = picker.options[1]!.value;
    fireEvent.change(picker, { target: { value: earlier } });
    expect(picker.value).toBe(earlier);
    expect(screen.getByText(/Your report card for/)).toBeInTheDocument();
  });
});
