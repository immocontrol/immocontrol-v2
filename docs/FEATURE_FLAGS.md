# Feature-Flags (experimentell)

Experimentelle oder noch nicht produktionsreife Funktionen können per **Umgebungsvariable** ein- und ausgeschaltet werden, ohne Code zu verzweigen über mehrere Branches.

## Konvention

- Präfix: **`VITE_FEATURE_`** + Name in **GROSSBUCHSTABEN** (nur Buchstaben und Ziffern; andere Zeichen werden zu `_`).
- Aktiv, wenn der Wert `true` oder `1` ist (String-Vergleich).

Beispiele in `.env` / Build-Args:

```bash
# Beispiel: neues UI für eine Seite testen
VITE_FEATURE_NEW_DEALS_UI=true
```

## Nutzung im Code

```ts
import { isFeatureEnabled } from "@/lib/featureFlags";

if (isFeatureEnabled("NEW_DEALS_UI")) {
  // experimenteller Pfad
}
```

Der Helper mappt `NEW_DEALS_UI` → `VITE_FEATURE_NEW_DEALS_UI`.

## Hinweise

- **`VITE_*`-Variablen** sind im Client-Bundle sichtbar — keine Geheimnisse dort ablegen.
- Für sensible Schalter nur **Server** (Edge Functions, Backend) verwenden.
- In Produktion standardmäßig alle Flags **aus** lassen, bis ein Feature freigegeben ist.
