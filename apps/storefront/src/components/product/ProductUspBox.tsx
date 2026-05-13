import { CheckCircle2, Award } from "lucide-react";

export function ProductUspBox() {
  const usps = [
    "Snelle levering, vóór 16:00 besteld?",
    "Klanten beoordelen ons met een 9.4/10",
    "De beste kwaliteit en service",
    "Alle pitten, zaden en notenmixen worden dagvers gebrand & verpakt",
  ];

  return (
    <div className="bg-white rounded-3xl p-6 lg:p-8 border border-brand-gold/30 shadow-lg h-fit relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-gold/5 rounded-bl-full pointer-events-none"></div>

      <div className="flex items-center gap-3 mb-6 border-b border-brand-gold/20 pb-4">
        <div className="bg-brand-primary text-brand-gold p-2 rounded-xl">
          <Award className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-brand-primary text-xl">Daarom DeNotenman</h3>
      </div>

      <ul className="space-y-4 relative z-10">
        {usps.map((usp, i) => (
          <li key={i} className="flex gap-4 text-brand-primary/80 leading-snug items-start">
            <CheckCircle2 className="w-5 h-5 text-brand-highlight shrink-0 mt-0.5" />
            <span
              dangerouslySetInnerHTML={{
                __html: usp.replace(
                  "dagvers gebrand & verpakt",
                  "<strong class='text-brand-primary'>dagvers gebrand & verpakt</strong>",
                ),
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
