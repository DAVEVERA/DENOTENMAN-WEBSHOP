import Link from "next/link";
import { Shield } from "lucide-react";

export const metadata = {
  title: "Privacybeleid",
  description: "Hoe De Notenman omgaat met jouw privacy en gegevens.",
};

export default function PrivacyPage() {
  return (
    <div className="bg-surface min-h-screen py-24">
      <div className="container-shop max-w-4xl">
        <div className="flex flex-col items-center text-center mb-16">
          <div className="h-16 w-16 bg-brand-primary text-brand-gold rounded-full flex items-center justify-center mb-6 shadow-lg">
            <Shield className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-brand-primary sm:text-5xl">
            Privacybeleid
          </h1>
          <p className="mt-4 text-lg text-brand-primary/70">Jouw gegevens zijn veilig bij ons.</p>
        </div>

        <div className="bg-white rounded-3xl p-8 sm:p-16 border-t-8 border-t-brand-primary shadow-xl prose prose-brand max-w-none">
          <h2 className="text-2xl font-bold text-brand-primary mb-4">1. Inleiding</h2>
          <p className="text-brand-primary/80 leading-relaxed mb-8">
            Welkom bij De Notenman. Wij hechten grote waarde aan de privacy van onze klanten en
            websitebezoekers. In dit privacybeleid leggen we uit welke persoonsgegevens we
            verzamelen, waarom we deze verzamelen, hoe we ze beschermen en wat jouw rechten zijn.
          </p>

          <h2 className="text-2xl font-bold text-brand-primary mb-4">
            2. Gegevens die we verzamelen
          </h2>
          <p className="text-brand-primary/80 leading-relaxed mb-4">
            Wanneer je een bestelling plaatst, een account aanmaakt of contact met ons opneemt,
            kunnen we de volgende gegevens verzamelen:
          </p>
          <ul className="list-disc pl-6 text-brand-primary/80 mb-8 space-y-2">
            <li>Voor- en achternaam</li>
            <li>Adresgegevens (factuur- en afleveradres)</li>
            <li>E-mailadres</li>
            <li>Telefoonnummer</li>
            <li>Betaalgegevens (via beveiligde payment providers)</li>
            <li>IP-adres en browserinformatie</li>
          </ul>

          <h2 className="text-2xl font-bold text-brand-primary mb-4">
            3. Doeleinden van de verwerking
          </h2>
          <p className="text-brand-primary/80 leading-relaxed mb-8">
            Jouw gegevens worden uitsluitend gebruikt voor het afhandelen van bestellingen, het
            leveren van klantenservice, en (indien je hiervoor toestemming hebt gegeven) het
            versturen van nieuwsbrieven. Wij verkopen jouw gegevens nooit aan derden.
          </p>

          <h2 className="text-2xl font-bold text-brand-primary mb-4">4. Beveiliging</h2>
          <p className="text-brand-primary/80 leading-relaxed mb-8">
            Wij nemen passende technische en organisatorische maatregelen om jouw persoonsgegevens
            te beveiligen tegen verlies, onrechtmatige toegang of enige vorm van onrechtmatige
            verwerking. Gegevens worden altijd verzonden via een beveiligde SSL-verbinding.
          </p>

          <h2 className="text-2xl font-bold text-brand-primary mb-4">5. Jouw rechten</h2>
          <p className="text-brand-primary/80 leading-relaxed mb-8">
            Je hebt het recht om je persoonsgegevens in te zien, te corrigeren of te verwijderen.
            Daarnaast heb je het recht om je eventuele toestemming voor de gegevensverwerking in te
            trekken of bezwaar te maken tegen de verwerking van jouw persoonsgegevens. Neem hiervoor
            contact met ons op via info@denotenman.nl.
          </p>
        </div>

        <div className="text-center mt-12">
          <Link
            href="/"
            className="inline-block text-brand-primary font-bold hover:text-brand-gold transition-colors underline decoration-brand-gold underline-offset-4"
          >
            Terug naar home
          </Link>
        </div>
      </div>
    </div>
  );
}
