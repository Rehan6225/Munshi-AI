import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceBar } from "./voice-bar";
import { StoreProvider } from "@/lib/store";

const spoken: string[] = [];

beforeEach(() => {
  localStorage.clear();
  spoken.length = 0;
  // jsdom has no speech engine; record what Munshi would say.
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
      getVoices: () => [{ lang: "en-IN", name: "Test India" }],
      cancel: () => {},
      speak: (u: { text: string }) => spoken.push(u.text),
    },
  });
});

async function setup() {
  render(
    <StoreProvider>
      <VoiceBar />
    </StoreProvider>,
  );
  const box = screen.getByLabelText("Voice command");
  // Wait for the store to finish loading.
  await act(() => new Promise((r) => setTimeout(r, 500)));
  return box;
}

describe("VoiceBar", () => {
  it("shows what Munshi heard, then saves and talks back", async () => {
    const box = await setup();
    fireEvent.change(box, { target: { value: "uh spent like 450, no wait, 480 on swiggy" } });
    fireEvent.keyDown(box, { key: "Enter" });

    await screen.findByText("What Munshi heard");
    expect(screen.getByText("450, no wait,", { exact: false })).toHaveClass("line-through");
    expect(screen.getByLabelText("Amount")).toHaveValue("480");

    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await screen.findByText(/Ho gaya!|Likh liya!/);
    expect(spoken.at(-1)).toMatch(/480 rupaye/);
    expect(spoken.at(-1)).not.toContain("₹");
  });

  it("stays quiet when muted", async () => {
    const box = await setup();
    fireEvent.click(screen.getByLabelText("Mute Munshi"));
    fireEvent.change(box, { target: { value: "200 on uber" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await screen.findByText("What Munshi heard");
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await screen.findByText(/Ho gaya!|Likh liya!/);
    expect(spoken).toEqual([]);
    fireEvent.click(screen.getByLabelText("Let Munshi speak"));
  });

  it("says when it didn't understand", async () => {
    const box = await setup();
    fireEvent.change(box, { target: { value: "hello there" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(screen.getByText(/samajh nahi aaya/)).toBeInTheDocument());
    expect(screen.queryByText("What Munshi heard")).toBeNull();
  });
});
