import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImportDialog } from "./import-dialog";
import { StoreProvider } from "@/lib/store";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => () => undefined }));

describe("ImportDialog", () => {
  it("opens the Bank SMS tab with sample alerts ready, and clears them for your own", () => {
    render(
      <StoreProvider>
        <ImportDialog>
          <button>Import</button>
        </ImportDialog>
      </StoreProvider>,
    );
    fireEvent.click(screen.getByText("Import"));
    fireEvent.click(screen.getByText("Bank SMS"));
    const box = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(box.value).toMatch(/HOUSE RENT/);
    expect(screen.getByText("Read messages")).toBeEnabled();

    fireEvent.click(screen.getByText("clear them"));
    expect(box.value).toBe("");
    expect(screen.getByText("Read messages")).toBeDisabled();
  });
});
