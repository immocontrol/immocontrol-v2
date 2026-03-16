import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ROUTES } from "@/lib/routes";

const Nutzungsbedingungen = () => {
  useEffect(() => {
    const prev = document.title;
    document.title = "Nutzungsbedingungen – ImmoControl";
    return () => { document.title = prev; };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground" role="main" aria-label="Nutzungsbedingungen">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <Link
          to={ROUTES.AUTH}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary rounded-md mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zur Anmeldung
        </Link>

        <h1 className="text-2xl font-bold mb-2">Nutzungsbedingungen</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Stand: {new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}
        </p>

        <div className="space-y-8 text-wrap-safe hyphens-auto">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Geltungsbereich</h2>
            <p className="text-sm text-muted-foreground">
              Diese Nutzungsbedingungen gelten für die Nutzung der Anwendung ImmoControl („App“) durch dich als Nutzerin oder Nutzer.
              Der Anbieter ist der in unserem Impressum genannte Verantwortliche.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Vertragsschluss und Konto</h2>
            <p className="text-sm text-muted-foreground">
              Mit der Registrierung und Nutzung der App kommt ein Nutzungsvertrag zustande. Du verpflichtest dich,
              die bei der Registrierung angegebenen Daten wahrheitsgemäß zu machen und dein Konto vor unbefugter
              Nutzung zu schützen. Die Nutzung erfolgt im Rahmen der angebotenen Funktionen und der geltenden Gesetze.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Leistungsumfang</h2>
            <p className="text-sm text-muted-foreground">
              Der Anbieter stellt die App und die damit verbundenen Dienste nach dem jeweiligen Leistungsstand
              zur Verfügung. Ein Anspruch auf bestimmte Funktionen, Verfügbarkeit oder Speicherdauer besteht nicht.
              Wartungsarbeiten und Anpassungen können die Nutzbarkeit zeitweise einschränken.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Deine Pflichten</h2>
            <p className="text-sm text-muted-foreground mb-2">
              Du nutzt die App nur für private oder geschäftliche Zwecke im Rahmen des geltenden Rechts. Du bist
              verantwortlich für die Inhalte, die du in der App anlegst. Du unterlässt insbesondere:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
              <li>rechtswidrige oder sittenwidrige Nutzung</li>
              <li>Eingriffe in die technische Infrastruktur oder in andere Nutzerkonten</li>
              <li>Weitergabe deiner Zugangsdaten an Dritte</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Haftung</h2>
            <p className="text-sm text-muted-foreground">
              Die Haftung des Anbieters ist auf Vorsatz und grobe Fahrlässigkeit sowie auf die Verletzung
              wesentlicher Vertragspflichten (Kardinalpflichten) beschränkt, soweit gesetzlich zulässig. Für
              mittelbare Schäden und Folgeschäden wird nicht gehaftet, sofern nicht zwingend gehaftet wird.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Kündigung und Löschung</h2>
            <p className="text-sm text-muted-foreground">
              Du kannst dein Konto jederzeit in den App-Einstellungen kündigen bzw. löschen lassen. Der Anbieter
              kann das Nutzungsverhältnis unter Einhaltung einer angemessenen Frist kündigen oder bei
              schwerwiegenden Verstößen gegen diese Nutzungsbedingungen sofort beenden.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Änderungen</h2>
            <p className="text-sm text-muted-foreground">
              Der Anbieter kann diese Nutzungsbedingungen anpassen. Wesentliche Änderungen werden dir
              mitgeteilt (z. B. per E-Mail oder in der App). Die Fortsetzung der Nutzung nach Wirksamwerden
              der Änderungen gilt als Zustimmung, sofern du nicht widersprichst.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Schlussbestimmungen</h2>
            <p className="text-sm text-muted-foreground">
              Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Gerichtsstand
              ist, soweit zulässig, der Sitz des Anbieters. Sollten einzelne Klauseln unwirksam sein, bleibt die
              Wirksamkeit der übrigen Bestimmungen unberührt.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-wrap gap-4">
          <Link
            to={ROUTES.IMPRESSUM}
            className="text-sm text-primary hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            Impressum
          </Link>
          <Link
            to={ROUTES.DATENSCHUTZ}
            className="text-sm text-primary hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            Datenschutz
          </Link>
          <Link
            to={ROUTES.AUTH}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary rounded-md"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück zur Anmeldung
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Nutzungsbedingungen;
