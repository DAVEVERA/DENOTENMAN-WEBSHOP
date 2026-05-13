import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Leaf, ShieldCheck, Heart } from "lucide-react";

export const metadata = {
  title: "Over Ons",
  description: "Het verhaal achter De Notenman: passie voor kwaliteit, verse producten en ambacht.",
};

export default function OverOnsPage() {
  return (
    <div className="bg-surface min-h-screen pb-24">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-brand-primary pt-32 pb-24">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url('/Branding/Lookenfeel.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        ></div>
        <div className="container-shop relative z-10 text-center">
          <Image
            src="/icons/Denotenmanlogo.png"
            alt="De Notenman Icon"
            width={80}
            height={80}
            className="mx-auto mb-6 opacity-90 invert object-contain"
          />
          <h1 className="text-4xl font-bold tracking-tight text-brand-gold sm:text-6xl drop-shadow-md">
            Onze Passie voor Kwaliteit
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-surface/90">
            Sinds de oprichting streven wij ernaar om alleen de allerbeste, verste en meest
            smaakvolle noten en zuidvruchten aan te bieden.
          </p>
        </div>
      </section>

      {/* Story Section */}
      <section className="container-shop mt-16 sm:mt-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="relative aspect-[4/5] w-full rounded-3xl overflow-hidden shadow-2xl border-4 border-brand-gold/20">
            <div className="absolute inset-0 bg-brand-primary/20 z-10 mix-blend-overlay"></div>
            <Image src="/Hero/hero2.png" alt="Ambachtelijke Noten" fill className="object-cover" />
          </div>

          <div className="flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold bg-brand-gold/10 px-4 py-1.5 text-sm font-bold text-brand-primary w-fit mb-6">
              <Heart className="h-4 w-4" />
              Het Verhaal
            </div>
            <h2 className="text-3xl font-bold text-brand-primary sm:text-4xl mb-6">
              Van de markt naar jouw voordeur
            </h2>
            <div className="space-y-6 text-brand-primary/80 text-lg leading-relaxed">
              <p>
                De Notenman begon jaren geleden met een eenvoudige marktkraam en één duidelijke
                missie: mensen laten genieten van écht verse kwaliteitsproducten. Waar supermarkten
                vaak kiezen voor massaproductie en lange houdbaarheid, kozen wij altijd voor smaak
                en versheid.
              </p>
              <p>
                Elke dag selecteren en branden wij onze noten met de hand. We keuren zendingen
                zorgvuldig af als ze niet aan onze strenge eisen voldoen. Die toewijding proef je in
                elke hap.
              </p>
              <p>
                Vandaag de dag leveren we niet alleen op de markt, maar bezorgen we onze
                ambachtelijke producten direct aan huis in de hele Benelux. De visie is echter nooit
                veranderd: topkwaliteit, zonder compromissen.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="container-shop mt-24 sm:mt-32">
        <h2 className="text-center text-3xl font-bold text-brand-primary sm:text-4xl mb-16">
          Waar we voor staan
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: Leaf,
              title: "100% Natuurlijk",
              desc: "Geen onnodige e-nummers of conserveringsmiddelen. Onze producten zijn zo puur als de natuur ze bedoeld heeft.",
            },
            {
              icon: ShieldCheck,
              title: "Strenge Kwaliteitscontrole",
              desc: "Wij werken alleen samen met gecertificeerde leveranciers en boeren die onze passie voor het vak delen.",
            },
            {
              icon: Heart,
              title: "Liefde voor het Ambacht",
              desc: "Van het branden in de juiste olie tot het luchtdicht verpakken; wij doen alles met de grootste zorgvuldigheid.",
            },
          ].map((val, idx) => (
            <div
              key={idx}
              className="bg-white rounded-3xl p-10 border border-brand-gold/30 shadow-lg text-center group hover:-translate-y-2 transition-all"
            >
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-primary text-brand-gold mb-6 group-hover:scale-110 transition-transform">
                <val.icon className="h-10 w-10" />
              </div>
              <h3 className="text-xl font-bold text-brand-primary mb-4">{val.title}</h3>
              <p className="text-brand-primary/70 leading-relaxed">{val.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container-shop mt-24 sm:mt-32">
        <div className="rounded-3xl bg-brand-primary p-12 text-center shadow-2xl border border-brand-gold relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `radial-gradient(var(--brand-gold) 2px, transparent 2px)`,
              backgroundSize: "20px 20px",
            }}
          ></div>
          <div className="relative z-10">
            <h2 className="text-3xl font-bold text-brand-gold sm:text-4xl">
              Overtuigd van onze kwaliteit?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-surface/90">
              Proef het verschil zelf. Ontdek ons ruime assortiment aan dagverse producten.
            </p>
            <Link
              href="/categorie/noten"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-brand-gold px-8 py-4 text-lg font-bold text-brand-primary transition-transform hover:scale-105"
            >
              Naar de shop <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
