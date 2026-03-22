import { describe, it, expect } from "vitest";
import { toErrorMessage } from "./handleError";

describe("toErrorMessage", () => {
  it("maps network-style errors to friendly message", () => {
    expect(toErrorMessage(new Error("Failed to fetch"), "general")).toMatch(/Internet|Verbindung/);
    expect(toErrorMessage(new Error("NetworkError"), "supabase")).toMatch(/Verbindung|Internet/);
  });

  it("maps auth/session errors", () => {
    expect(toErrorMessage(new Error("JWT expired"), "general")).toMatch(/Sitzung|anmelden/);
    expect(toErrorMessage(new Error("401 unauthorized"), "auth")).toMatch(/Sitzung|anmelden/);
  });

  it("maps not-found style errors", () => {
    expect(toErrorMessage(new Error("pgrst116"), "supabase")).toMatch(/nicht gefunden|neu laden/i);
  });

  it("uses context fallback when no pattern matches", () => {
    expect(toErrorMessage(new Error("Something weird xyz"), "export")).toBe(
      "Export fehlgeschlagen. Bitte erneut versuchen.",
    );
    expect(toErrorMessage(new Error("Something weird xyz"), "general")).toBe(
      "Ein Fehler ist aufgetreten. Bitte erneut versuchen.",
    );
  });

  it("normalizes non-Error values", () => {
    expect(toErrorMessage("plain string", "validation")).toBe("Eingabe ungültig. Bitte prüfen Sie die Felder.");
  });
});
