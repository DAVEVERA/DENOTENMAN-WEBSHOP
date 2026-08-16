import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { DE_NOTENMAN_PRODUCTS } from "./src/data/products";
import { UserPreferences, NutProduct, RecommendationItem, NutRecommendation } from "./src/types";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "5mb" }));

// Initialize Gemini Client server-side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// GET /api/products
app.get("/api/products", (req, res) => {
  res.json({
    success: true,
    products: DE_NOTENMAN_PRODUCTS,
    count: DE_NOTENMAN_PRODUCTS.length,
  });
});

// POST /api/recommend - Generates AI Nut Proposal strictly from De Notenman Database
app.post("/api/recommend", async (req, res) => {
  try {
    const preferences: UserPreferences = req.body;

    if (!preferences || typeof preferences !== "object") {
      return res.status(400).json({ error: "Ongeldige aanvraag gegevens." });
    }

    if (!preferences.avgConsented) {
      return res.status(400).json({
        error: "Akkoord met AVG privacyvoorwaarden is vereist om een advies te verwerken.",
      });
    }

    const {
      occasion = "borrel",
      peopleCount = 4,
      budget = 25,
      mixPreference = "vers-gebrand-gezouten",
      dietary = [],
      allergensToAvoid = [],
      customNotes = "",
    } = preferences;

    // 1. Strict Server-Side Allergen Filtering (Zero tolerance rule)
    const eligibleProducts = DE_NOTENMAN_PRODUCTS.filter((product) => {
      if (!product.inStock) return false;
      if (allergensToAvoid && allergensToAvoid.length > 0) {
        const hasForbiddenAllergen = allergensToAvoid.some((allergen) =>
          product.allergens.includes(allergen)
        );
        if (hasForbiddenAllergen) return false;
      }
      return true;
    });

    if (eligibleProducts.length === 0) {
      return res.status(400).json({
        error:
          "Met de huidige allergiefilters zijn er helaas geen geschikte producten beschikbaar in ons assortiment. Probeer uw filters aan te passen.",
      });
    }

    // 2. Prepare concise catalog payload for Gemini
    const catalogForAi = eligibleProducts.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      pricePer250g: p.pricePer250g,
      pricePer500g: p.pricePer500g,
      pricePer1000g: p.pricePer1000g,
      description: p.description,
      allergens: p.allergens,
      dietary: p.dietary,
      tasteProfile: p.tasteProfile,
    }));

    const systemInstruction = `
Je bent de Hoofd Notenbrander & Notenspecialist van 'De Notenman' (denotenman.com, ambacht sinds 1978).
Je taak is om een perfect uitgebalanceerd notenvoorstel op maat samen te stellen op basis van klantvoorkeuren.

STRIKTE BRON- REGELS:
1. Je MAG UITSLUITEND producten selecteren uit de verstrekte catalogus 'catalogForAi'.
2. Gebruik ALLEEN de opgegeven product IDs (id). Verzin NOOIT eigen productnamen of externe noten!
3. respecteer allergieën streng: er zijn al gefilterde producten, kies uit de lijst.
4. BEREKENING & BUDGET:
   - Klant verwacht: ${peopleCount} personen.
   - Beschikbaar budget: €${budget}.
   - Gelegenheid: ${occasion}.
   - Smaakvoorkeur: ${mixPreference}.
   - Dieetwensen: ${dietary.join(", ") || "Geen specifieke"}.
   - Opmerkingen: "${customNotes}".
5. Bepaal een slimme combinatiemix (meestal 2 tot 5 verschillende producten).
6. Kies voor elk product een logische verpakkingsgrootte in grammen (250, 500 of 1000) en het aantal verpakkingen.
7. Geef bij elk item een enthousiaste, vakbekwame motivering ("Waarom gekozen").
8. Geef serieuze serveertips voor De Notenman sfeer.
`;

    const userPrompt = `
Gelieve een notenvoorstel te genereren voor:
- Aantal personen: ${peopleCount}
- Budget: €${budget}
- Gelegenheid: ${occasion}
- Smaakvoorkeur: ${mixPreference}
- Dieetwensen: ${dietary.join(", ") || "geen"}
- Allergieën om te vermijden: ${allergensToAvoid.join(", ") || "geen"}
- Extra wensen: ${customNotes || "geen"}

Beschikbaar De Notenman Assortiment JSON:
${JSON.stringify(catalogForAi)}
`;

    // Call Gemini 3.6 Flash
    const geminiResponse = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Pakkende titel voor dit notenvoorstel" },
            introduction: { type: Type.STRING, description: "Warme ambachtelijke introductie van De Notenman" },
            portionAdvice: { type: Type.STRING, description: "Uitleg over de grammage per persoon voor deze gelegenheid" },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  productId: { type: Type.STRING, description: "Exact id uit catalogus" },
                  packageSizeGrams: { type: Type.INTEGER, description: "250, 500 of 1000" },
                  packageCount: { type: Type.INTEGER, description: "Aantal verpakkingen" },
                  reasoning: { type: Type.STRING, description: "Waarom dit product past" },
                },
                required: ["productId", "packageSizeGrams", "packageCount", "reasoning"],
              },
            },
            dietaryGuarantees: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Garantiestempels zoals 100% Pindavrij, Vegan, etc.",
            },
            presentationTips: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Serveertips & bewaartips",
            },
          },
          required: ["title", "introduction", "portionAdvice", "items", "dietaryGuarantees", "presentationTips"],
        },
      },
    });

    const responseText = geminiResponse.text;
    if (!responseText) {
      throw new Error("Geen reactie ontvangen van AI module.");
    }

    const parsedAiResult = JSON.parse(responseText);

    // 3. Recalculate and Verify Price & Weight on Server with Real Database Data
    let totalWeightGrams = 0;
    let totalPrice = 0;

    const validatedItems: RecommendationItem[] = [];

    for (const item of parsedAiResult.items || []) {
      const dbProduct = DE_NOTENMAN_PRODUCTS.find((p) => p.id === item.productId);
      if (!dbProduct) continue;

      const packageSize = [250, 500, 1000].includes(item.packageSizeGrams)
        ? item.packageSizeGrams
        : 250;
      const count = Math.max(1, item.packageCount || 1);

      let unitPrice = dbProduct.pricePer250g;
      if (packageSize === 500) unitPrice = dbProduct.pricePer500g;
      if (packageSize === 1000) unitPrice = dbProduct.pricePer1000g;

      const subtotal = Number((unitPrice * count).toFixed(2));
      const itemWeight = packageSize * count;

      totalPrice += subtotal;
      totalWeightGrams += itemWeight;

      validatedItems.push({
        productId: dbProduct.id,
        productName: dbProduct.name,
        packageSizeGrams: packageSize,
        packageCount: count,
        pricePerUnit: unitPrice,
        subtotalPrice: subtotal,
        reasoning: item.reasoning,
        product: dbProduct,
      });
    }

    // Fallback if AI produced 0 valid items
    if (validatedItems.length === 0) {
      const fallbackProd = eligibleProducts[0];
      const subtotal = fallbackProd.pricePer250g * 2;
      validatedItems.push({
        productId: fallbackProd.id,
        productName: fallbackProd.name,
        packageSizeGrams: 250,
        packageCount: 2,
        pricePerUnit: fallbackProd.pricePer250g,
        subtotalPrice: subtotal,
        reasoning: "Ambachtelijke keuze speciaal passend binnen uw budget.",
        product: fallbackProd,
      });
      totalPrice = subtotal;
      totalWeightGrams = 500;
    }

    totalPrice = Number(totalPrice.toFixed(2));

    let budgetStatus: "within" | "slightly-over" | "under" = "within";
    if (totalPrice > budget + 3) budgetStatus = "slightly-over";
    else if (totalPrice < budget - 5) budgetStatus = "under";

    const recommendation: NutRecommendation = {
      id: "rec-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
      title: parsedAiResult.title || "Gepersonaliseerd De Notenman Voorstel",
      createdAt: new Date().toISOString(),
      introduction: parsedAiResult.introduction || "Vers voor u samengesteld door onze brandmeesters.",
      portionAdvice:
        parsedAiResult.portionAdvice ||
        `Voor ${peopleCount} personen adviseren wij circa ${(totalWeightGrams / peopleCount).toFixed(0)}g noten per gast.`,
      items: validatedItems,
      totalWeightGrams,
      totalPrice,
      budgetStatus,
      dietaryGuarantees: parsedAiResult.dietaryGuarantees || ["100% Kwaliteitsgarantie De Notenman"],
      presentationTips:
        parsedAiResult.presentationTips || [
          "Bewaar de noten luchtdicht op kamertemperatuur voor optimale versheid.",
          "Serveer verschillende noten in afzonderlijke schaaltjes op uw borrelplank.",
        ],
      originalPreferences: preferences,
    };

    return res.json({
      success: true,
      recommendation,
    });
  } catch (error: any) {
    console.error("Fout in /api/recommend:", error);
    return res.status(500).json({
      error: "Er is een fout opgetreden bij het genereren van uw notenvoorstel. Probeer het opnieuw.",
      details: error?.message || String(error),
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`De Notenman Server is running on http://localhost:${PORT}`);
  });
}

startServer();
