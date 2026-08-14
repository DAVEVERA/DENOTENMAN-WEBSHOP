import { Shield } from "lucide-react";

export function Privacy({ locale }: { locale: string }) {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-col items-center text-center mb-12">
        <div className="h-16 w-16 bg-contrast text-accent rounded-full flex items-center justify-center mb-6 shadow-md">
          <Shield className="h-8 w-8" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-contrast sm:text-5xl">
          Privacybeleid
        </h1>
        <p className="mt-4 text-lg text-muted">Jouw gegevens zijn veilig bij ons.</p>
      </div>

      <div className="bg-surface rounded-panel p-8 sm:p-12 border-t-8 border-t-accent shadow-card prose max-w-none text-text">
        <h2 className="text-2xl font-bold text-contrast mb-4">1. Inleiding</h2>
        <p className="leading-relaxed mb-8">
          Welkom bij De Notenman. Wij hechten grote waarde aan de privacy van onze klanten en
          websitebezoekers. In dit privacybeleid leggen we uit welke persoonsgegevens we
          verzamelen, waarom we deze verzamelen, hoe we ze beschermen en wat jouw rechten zijn.
        </p>

        <h2 className="text-2xl font-bold text-contrast mb-4">
          2. Gegevens die we verzamelen
        </h2>
        <p className="leading-relaxed mb-4">
          Wanneer je een bestelling plaatst, een account aanmaakt of contact met ons opneemt,
          kunnen we de volgende gegevens verzamelen:
        </p>
        <ul className="list-disc pl-6 mb-8 space-y-2">
          <li>Voor- en achternaam</li>
          <li>Adresgegevens (factuur- en afleveradres)</li>
          <li>E-mailadres</li>
          <li>Telefoonnummer</li>
          <li>Betaalgegevens (via beveiligde payment providers)</li>
          <li>IP-adres en browserinformatie</li>
        </ul>

        <h2 className="text-2xl font-bold text-contrast mb-4">
          3. Doeleinden van de verwerking
        </h2>
        <p className="leading-relaxed mb-8">
          Jouw gegevens worden uitsluitend gebruikt voor het afhandelen van bestellingen, het
          leveren van klantenservice, en (indien je hiervoor toestemming hebt gegeven) het
          versturen van nieuwsbrieven. Wij verkopen jouw gegevens nooit aan derden.
        </p>

        <h2 className="text-2xl font-bold text-contrast mb-4">4. Beveiliging</h2>
        <p className="leading-relaxed mb-8">
          Wij nemen passende technische en organisatorische maatregelen om jouw persoonsgegevens
          te beveiligen tegen verlies, onrechtmatige toegang of enige vorm van onrechtmatige
          verwerking. Gegevens worden altijd verzonden via een beveiligde SSL-verbinding.
        </p>

        <h2 className="text-2xl font-bold text-contrast mb-4">5. Jouw rechten</h2>
        <p className="leading-relaxed mb-8">
          Je hebt het recht om je persoonsgegevens in te zien, te corrigeren of te verwijderen.
          Daarnaast heb je het recht om je eventuele toestemming voor de gegevensverwerking in te
          trekken of bezwaar te maken tegen de verwerking van jouw persoonsgegevens. Neem hiervoor
          contact met ons op via info@denotenman.com.
        </p>
      </div>
    </div>
  );
}
