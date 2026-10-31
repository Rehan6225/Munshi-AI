import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, type ComponentType } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { Route } from "./coach";
import { StoreProvider, useStore } from "@/lib/store";

const Coach = Route.options.component as ComponentType;

function WithDemo() {
  const { hydrated, mode, loadDemo } = useStore();
  useEffect(() => {
    if (hydrated && !mode) loadDemo();
  }, [hydrated, mode, loadDemo]);
  return hydrated && mode ? <Coach /> : null;
}

async function setup() {
  render(
    <StoreProvider>
      <WithDemo />
    </StoreProvider>,
  );
  await act(() => new Promise((r) => setTimeout(r, 500)));
}

describe("Coach", () => {
  beforeEach(() => localStorage.clear());

  it("refuses stock picks, and teaches with the user's own numbers instead", async () => {
    await setup();
    fireEvent.click(screen.getByRole("button", { name: "Which stock should I buy?" }));
    expect(await screen.findByText(/can't recommend specific stocks/)).toBeInTheDocument();
    expect(screen.getByText(/SEBI-registered/)).toBeInTheDocument();
    expect(screen.getByText(/₹10,000 a month into investments/)).toBeInTheDocument();
    expect(screen.getByText("Guardrail")).toBeInTheDocument();
  });

  it("answers money questions from the user's data", async () => {
    await setup();
    const box = screen.getByLabelText("Ask Munshi ji");
    fireEvent.change(box, { target: { value: "how much did I spend on swiggy?" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(await screen.findByText(/at Swiggy, over 3 payments/)).toBeInTheDocument();
    expect(screen.getByText("On-device")).toBeInTheDocument();
  });
});
