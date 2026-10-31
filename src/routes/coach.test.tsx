import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, type ComponentType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

const spoken: string[] = [];

describe("Coach", () => {
  beforeEach(() => {
    localStorage.clear();
    spoken.length = 0;
    // jsdom has no speech engine; record what Munshi would say with his Hindi voice.
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        text: string;
        lang = "";
        rate = 1;
        voice: unknown = null;
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      },
    );
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [{ lang: "hi-IN", name: "Google हिन्दी" }],
        cancel: () => {},
        speak: (u: { text: string }) => spoken.push(u.text),
      },
    });
  });

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

  it("reads answers aloud by itself, with amounts in English words", async () => {
    await setup();
    const box = screen.getByLabelText("Ask Munshi ji");
    fireEvent.change(box, { target: { value: "how much did I spend on swiggy?" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await screen.findByText(/at Swiggy, over 3 payments/);
    expect(spoken.at(-1)).toMatch(/rupees at Swiggy, over three payments/);
    expect(spoken.at(-1)).not.toMatch(/\d/);
  });

  it("stays quiet when muted from the Coach header", async () => {
    await setup();
    fireEvent.click(screen.getByLabelText("Mute Munshi"));
    fireEvent.click(screen.getByRole("button", { name: "How can I save more?" }));
    await screen.findByText(/easy wins/);
    expect(spoken).toEqual([]);
    fireEvent.click(screen.getByLabelText("Let Munshi speak"));
  });
});
