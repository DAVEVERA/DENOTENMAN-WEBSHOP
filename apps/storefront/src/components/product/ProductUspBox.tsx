import { CheckCircle2 } from "lucide-react";

export function ProductUspBox() {
  const usps = [
    "Snelle levering, vóór 16:00 besteld?",
    "Klanten beoordelen ons: 9.4/10",
    "De beste kwaliteit en service",
    "Alle pitten, zaden en notenmixen worden dagvers gebrand & verpakt",
  ];

  return (
    <div className="bg-brand-green-50 rounded-2xl p-6 lg:p-8 border border-brand-green-100 h-fit">
      <h3 className="font-bold text-neutral-900 mb-6 text-lg">Daarom De Notenman.</h3>
      <ul className="space-y-4">
        {usps.map((usp, i) => (
          <li key={i} className="flex gap-3 text-sm text-neutral-700 leading-snug">
            <CheckCircle2 className="w-5 h-5 text-brand-green shrink-0" />
            <span
              dangerouslySetInnerHTML={{
                __html: usp.replace(
                  "dagvers gebrand & verpakt",
                  "<strong>dagvers gebrand & verpakt</strong>",
                ),
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
