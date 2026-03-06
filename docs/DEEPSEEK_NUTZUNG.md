# Wofür du DeepSeek in ImmoControl nutzen kannst

Mit gesetztem **VITE_DEEPSEEK_API_KEY** stehen dir folgende und erweiterbare KI-Funktionen zur Verfügung.

---

## Bereits umgesetzt

| Funktion | Wo | Beschreibung |
|----------|-----|--------------|
| **Immo-Chat** | Seite „Immo-AI“, Chat-Bubble | Fragen zu Portfolio, Mieten, Darlehen, Rendite – Antworten auf Deutsch, gestreamt. |
| **KI-Tipp** | Dashboard | Kurzer monatlicher Immobilien-Tipp (1–3 Sätze), mit Aktualisieren-Button. |
| **PDF mit KI auswerten** | Immo-AI → Tab „PDF auswerten“ | PDF hochladen → Text wird extrahiert → DeepSeek fasst zusammen oder extrahiert Struktur (Vertrag, Exposé, Rechnung). Preset-Buttons und eigene Frage möglich. |

---

## Weitere Ideen (ohne Garantie der Umsetzung)

- **Verträge (Mietvertrag, Darlehen):**  
  PDF hochladen → KI extrahiert Fristen, Miete, Kündigung, Besonderheiten → optional in App-Felder übernehmen (z. B. Vertragsende, Kündigungsfrist).

- **Exposé-Analyse:**  
  Exposé-PDF oder Text → Stichpunkte zu Objekt, Lage, Preis, Miete, Risiken; optional Deal-Score oder Vergleich mit deinen Kriterien.

- **Dokumente-Kategorisierung:**  
  Beim Hochladen: KI schlägt Kategorie vor (Mietvertrag, Nebenkostenabrechnung, …) anhand des Inhalts.

- **E-Mails / Nachrichten:**  
  (Falls du Mieter-Anfragen o. Ä. in der App abbildest) KI fasst Anfrage zusammen, schlägt Kategorie oder Standardantwort vor.

- **Objektbeschreibung generieren:**  
  Aus Stammdaten (Adresse, Typ, m², Miete, …) einen kurzen Anzeigen- oder Exposé-Text erzeugen.

- **Selbstauskunft / Anschreiben:**  
  Vorlagen für Mieter-Selbstauskunft, Kündigung, Mietanpassung ausformulieren (mit Platzhaltern).

- **Berichte in Prosa:**  
  Aus Portfolio-Kennzahlen einen kurzen „Monatsbericht“ oder „Jahresüberblick“ in Fließtext erzeugen.

- **Rechtschreibung & Formulierung:**  
  Eigene Texte (z. B. Anschreiben, Notizen) prüfen und verbessern lassen.

---

## Technik

- **API:** DeepSeek Chat Completions (OpenAI-kompatibel), Modell `deepseek-chat`.
- **PDF-Text:** Wird mit pdfjs-dist (layout-aware in `exposeParser`) extrahiert; bei sehr langen PDFs wird der Text für die API gekürzt (~12.000 Zeichen).
- **Hinweis:** Scans/Bild-PDFs liefern ohne OCR keinen Text; dann bleibt die PDF-Auswertung wirkungslos, bis du eine OCR-Stufe einbaust.
