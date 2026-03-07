# Wofür du DeepSeek in ImmoControl nutzen kannst

Mit gesetztem **VITE_DEEPSEEK_API_KEY** stehen dir folgende und erweiterbare KI-Funktionen zur Verfügung.

---

## Bereits umgesetzt

| Funktion | Wo | Beschreibung |
|----------|-----|--------------|
| **Immo-Chat** | Seite „Immo-AI“, Chat-Bubble | Fragen zu Portfolio, Mieten, Darlehen, Rendite, **Tickets** – Antworten auf Deutsch, gestreamt. System-Kontext: Properties, Tenants, Loans, Todos, Tickets, Deals, Besichtigungen. Vorgeschlagene Frage: „Wie viele offene Tickets habe ich?“ |
| **KI-Tipp** | Dashboard | Kurzer monatlicher Immobilien-Tipp (1–3 Sätze), mit Aktualisieren-Button. |
| **PDF mit KI auswerten** | Immo-AI → Tab „PDF auswerten“ | PDF hochladen → Text extrahiert → DeepSeek fasst zusammen. Presets: Vertrag, Exposé (Stichpunkte), **Exposé: Analyse + Bewertung**, Rechnung. Eigene Frage möglich. |
| **ViewingAISummary** | Besichtigungen (Dialog) | Fasst Notizen, Pro/Kontra zu einer Kurzfassung (3–5 Sätze). |
| **PropertyDescriptionGenerator** | Immo-AI → Tab „PDF auswerten“ | Objektbeschreibung aus Stammdaten oder manueller Eingabe generieren. |
| **BerichteInProsa** | Immo-AI → Tab „PDF auswerten“ | Monatsbericht oder Jahresüberblick aus Portfolio-Kennzahlen (DeepSeek). |
| **PropertyNotes** | Objekt-Detail → Notizen | Button „Zusammenfassen" – KI fasst alle Notizen zusammen. |
| **TicketSystem** | Neue Anfrage (Mieter) | Button „Vorschlag" – KI generiert Beschreibung aus Titel + Kategorie. |
| **IndexMietanpassung** | Mietübersicht / Verträge | Button „Begründung generieren" (Sparkles) – KI erstellt formelle Begründung; Text wird in Zwischenablage kopiert. |
| **RentIncreaseLetter** | Verträge (Mieterhöhungsschreiben) | Button „KI-Begründung" (generateRentIncreaseJustification) und „Text verbessern" (improveText) – Rechtschreibung, Stil, Formulierung für Begründung §558 BGB. |
| **Deals** | Deal-Bearbeitung (Notizen) | Button „Verbessern" (improveText) – KI überarbeitet Deal-Notizen (Stil, Vollständigkeit). |
| **PropertyDocuments** | Objekt-Dokumente | Beim PDF-Upload: KI schlägt Kategorie vor (suggestDocumentCategory) bei DeepSeek-Konfiguration. |
| **Deals** | Deal bearbeiten | Button „Nächster Schritt“ (suggestDealNextStep): KI schlägt nächsten konkreten Deal-Schritt vor (Stage, Titel, Adresse, Notizen). |
| **MessageCenter** | Nachrichten | Button „Antwort vorschlagen“ (suggestReply): KI schlägt sachliche Antwort auf Mieter-Nachricht vor. |
| **Selbstauskunft** | Finanzierungs-Cockpit → Generator, Schritt Zusammenfassung | Button „KI: Zusammenfassung prüfen“ (suggestSelbstauskunftSummary): banktauglicher Kurzabsatz zu Einnahmen, Ausgaben, Überschuss, Vermögen. |
| **Entwicklungsplan** | Objekt-Detail → Entwicklungsplan | Button „Kurztext generieren“ (suggestEntwicklungsplanSummary): Absatz für Bankanschreiben zum Entwicklungspotenzial (Mietanpassung, Zielmiete, Maßnahmen). |

---

## Weitere Ideen (ohne Garantie der Umsetzung)

- **Verträge (Mietvertrag, Darlehen):**  
  PDF hochladen → KI extrahiert Fristen, Miete, Kündigung, Besonderheiten → optional in App-Felder übernehmen (z. B. Vertragsende, Kündigungsfrist).

- **Exposé-Analyse:**  
  ✅ Teilweise umgesetzt: Preset „Exposé: Analyse + Bewertung“ in PdfWithAI. Stichpunkte, Chancen, Risiken, grobe Rendite-Einschätzung.

- **Dokumente-Kategorisierung:**  
  Beim Hochladen: KI schlägt Kategorie vor (Mietvertrag, Nebenkostenabrechnung, …) anhand des Inhalts.

- **Darlehens-PDF mit DeepSeek:**  
  ✅ Umgesetzt (LoanPdfImport). Wenn Regex nur wenige Felder findet, nutzt die App bei gesetztem VITE_DEEPSEEK_API_KEY `extractLoanFromText` zur AI-Extraktion von Bank, Betrag, Zinssatz, Tilgung, Zinsbindung etc.

- **E-Mails / Nachrichten:**  
  (Falls du Mieter-Anfragen o. Ä. in der App abbildest) KI fasst Anfrage zusammen, schlägt Kategorie oder Standardantwort vor.

- **Objektbeschreibung generieren:**  
  ✅ Umgesetzt (Immo-AI → PropertyDescriptionGenerator). Aus Stammdaten oder manueller Eingabe.

- **Selbstauskunft / Anschreiben:**  
  ✅ Teilweise: Generator-Schritt „Zusammenfassung“ hat KI-Button für banktaugliche Kurzfassung. Vorlagen für Mieter-Selbstauskunft, Kündigung, Mietanpassung ausformulieren (mit Platzhaltern).

- **Berichte in Prosa:**  
  ✅ Umgesetzt (Immo-AI → BerichteInProsa). Monatsbericht oder Jahresüberblick aus Portfolio-Kennzahlen.

- **Rechtschreibung & Formulierung:**  
  Eigene Texte (z. B. Anschreiben, Notizen) prüfen und verbessern lassen.

---

## Technik

- **API:** DeepSeek Chat Completions (OpenAI-kompatibel), Modell `deepseek-chat`.
- **PDF-Text:** Wird mit pdfjs-dist (layout-aware in `exposeParser`) extrahiert; bei sehr langen PDFs wird der Text für die API gekürzt (~12.000 Zeichen).
- **Hinweis:** Scans/Bild-PDFs liefern ohne OCR keinen Text; dann bleibt die PDF-Auswertung wirkungslos, bis du eine OCR-Stufe einbaust.
