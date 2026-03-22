import { describe, it, expect } from "vitest";
import { getMutationErrorMessage } from "./mutationErrorHandler";

describe("getMutationErrorMessage", () => {
  it("maps unique violation code", () => {
    expect(getMutationErrorMessage({ code: "23505", message: "duplicate" })).toBe("Dieser Eintrag existiert bereits");
  });

  it("maps network errors", () => {
    expect(getMutationErrorMessage(new Error("Failed to fetch"))).toBe("Netzwerkfehler — bitte Internetverbindung prüfen");
    expect(getMutationErrorMessage(new Error("NetworkError when fetching"))).toBe(
      "Netzwerkfehler — bitte Internetverbindung prüfen",
    );
  });

  it("maps refresh token / session errors", () => {
    expect(getMutationErrorMessage(new Error("Invalid Refresh Token: refresh_token_not_found"))).toBe(
      "Sitzung abgelaufen — bitte erneut anmelden",
    );
    expect(getMutationErrorMessage({ message: "invalid_grant", code: "" })).toBe("Sitzung abgelaufen — bitte erneut anmelden");
    expect(getMutationErrorMessage(new Error("JWT expired"))).toBe("Sitzung abgelaufen — bitte erneut anmelden");
  });

  it("returns string for string input", () => {
    expect(getMutationErrorMessage("Etwas")).toBe("Etwas");
  });

  it("fallback for unknown", () => {
    expect(getMutationErrorMessage(null)).toBe("Ein unbekannter Fehler ist aufgetreten");
    expect(getMutationErrorMessage({})).toBe("Ein unbekannter Fehler ist aufgetreten");
  });
});
