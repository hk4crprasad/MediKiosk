/**
 * Ayurvedic Prakriti, Tridosha & Dashavidha Clinical Evaluator
 * Based on Classical Charaka Samhita & Ministry of AYUSH Guidelines
 */

export type TridoshaProfile = {
  isAyushEncounter: boolean;
  vataPct: number;
  pittaPct: number;
  kaphaPct: number;
  dominantDosha: string;
  prakritiLabel: string;
  agniType: string;
  agniDescription: string;
  koshthaType: string;
  koshthaDescription: string;
  sattvaLevel: string;
  dhatuSara: string;
  lifestyleFactors: string[];
  clinicalInsights: string[];
};

export function evaluateAyushProfile(
  facts: Array<{ fact_type: string; value: Record<string, unknown> }>
): TridoshaProfile | null {
  const ayushFacts: Record<string, string> = {};
  for (const f of facts) {
    if (f.fact_type.startsWith("ayush_")) {
      const val = String(f.value.value ?? f.value.choice ?? f.value.raw_text ?? "").toLowerCase();
      ayushFacts[f.fact_type] = val;
    }
  }

  if (Object.keys(ayushFacts).length === 0) {
    return null;
  }

  let vataScore = 20;
  let pittaScore = 20;
  let kaphaScore = 20;

  // 1. Prakriti weighting
  const prakriti = ayushFacts["ayush_prakriti"] || "";
  if (prakriti.includes("vata")) { vataScore += 35; }
  else if (prakriti.includes("pitta")) { pittaScore += 35; }
  else if (prakriti.includes("kapha")) { kaphaScore += 35; }
  else if (prakriti.includes("mixed")) { vataScore += 15; pittaScore += 15; kaphaScore += 15; }

  // 2. Agni weighting
  const agni = ayushFacts["ayush_agni"] || "";
  let agniType = "Samagni (Balanced Digestive Fire)";
  let agniDescription = "Optimal digestive capacity and nutrient absorption.";
  if (agni.includes("vishamagni") || agni.includes("irregular")) {
    vataScore += 20;
    agniType = "Vishamagni (Irregular / Vata-dominant Fire)";
    agniDescription = "Variable appetite with bloating or irregular digestion.";
  } else if (agni.includes("tikshnagni") || agni.includes("increased")) {
    pittaScore += 20;
    agniType = "Tikshnagni (Hyperactive / Pitta-dominant Fire)";
    agniDescription = "Intense hunger, tendency toward hyperacidity or burning sensation.";
  } else if (agni.includes("mandagni") || agni.includes("reduced")) {
    kaphaScore += 20;
    agniType = "Mandagni (Sluggish / Kapha-dominant Fire)";
    agniDescription = "Slow metabolic rate with post-meal heaviness or lethargy.";
  }

  // 3. Koshtha weighting
  const koshtha = ayushFacts["ayush_koshtha"] || "";
  let koshthaType = "Madhyama Koshtha (Balanced)";
  let koshthaDescription = "Regular daily evacuation without difficulty.";
  if (koshtha.includes("krura") || koshtha.includes("constipation")) {
    vataScore += 15;
    koshthaType = "Krura Koshtha (Hard / Dry Bowel Nature)";
    koshthaDescription = "Predisposition to dry stools and constipation (Vata-induced).";
  } else if (koshtha.includes("mridu") || koshtha.includes("loose")) {
    pittaScore += 15;
    koshthaType = "Mridu Koshtha (Soft / Rapid Bowel Nature)";
    koshthaDescription = "Tendency towards loose stools on mild dietary changes (Pitta-induced).";
  }

  // 4. Vikriti & Symptoms
  const vikriti = ayushFacts["ayush_vikriti"] || "";
  if (vikriti.includes("pain")) vataScore += 15;
  if (vikriti.includes("fever") || vikriti.includes("warmth")) pittaScore += 15;
  if (vikriti.includes("digestive")) { vataScore += 10; pittaScore += 10; }

  // 5. Stress & Sattva
  const sattva = ayushFacts["ayush_sattva"] || "";
  let sattvaLevel = "Madhyama Sattva (Moderate Psychological Resilience)";
  if (sattva.includes("calm")) {
    sattvaLevel = "Pravara Sattva (High Mental Strength & Calmness)";
  } else if (sattva.includes("often") || sattva.includes("stressed")) {
    sattvaLevel = "Avara Sattva (High Sensitivity to Stress & Mental Fatigue)";
    vataScore += 10;
  }

  // 6. Sara (Tissue Vitality)
  const sara = ayushFacts["ayush_sara"] || "moderate";
  let dhatuSara = "Madhyama Sara (Moderate Dhatu Integrity)";
  if (sara.includes("good")) dhatuSara = "Pravara Sara (Superior Tissue Excellence & Immunity)";
  if (sara.includes("low")) dhatuSara = "Avara Sara (Low Dhatu Strength, requires Rasayana Support)";

  // Compute percentages
  const total = vataScore + pittaScore + kaphaScore;
  const vataPct = Math.round((vataScore / total) * 100);
  const pittaPct = Math.round((pittaScore / total) * 100);
  const kaphaPct = 100 - vataPct - pittaPct;

  let dominantDosha = "Vata-Pitta";
  if (vataPct >= pittaPct && vataPct >= kaphaPct) dominantDosha = "Vata Pradhana (Air & Ether Dominance)";
  else if (pittaPct >= vataPct && pittaPct >= kaphaPct) dominantDosha = "Pitta Pradhana (Fire & Water Dominance)";
  else dominantDosha = "Kapha Pradhana (Earth & Water Dominance)";

  // Lifestyle Factors
  const lifestyleFactors: string[] = [];
  if (ayushFacts["ayush_ahara"]) lifestyleFactors.push(`Diet Habit: ${ayushFacts["ayush_ahara"].replace(/_/g, " ")}`);
  if (ayushFacts["ayush_vihara"]) lifestyleFactors.push(`Daily Routine: ${ayushFacts["ayush_vihara"].replace(/_/g, " ")}`);
  if (ayushFacts["ayush_ahara_shakti"]) lifestyleFactors.push(`Appetite Capacity: ${ayushFacts["ayush_ahara_shakti"].replace(/_/g, " ")}`);
  if (ayushFacts["ayush_vyayama_shakti"]) lifestyleFactors.push(`Exertion Capacity: ${ayushFacts["ayush_vyayama_shakti"].replace(/_/g, " ")}`);

  // Clinical Insights
  const clinicalInsights: string[] = [
    `Primary Constitutional Imbalance: ${dominantDosha}`,
    `Agni Assessment: ${agniType}`,
    `Koshtha Nature: ${koshthaType}`,
    `Psychological State: ${sattvaLevel}`,
  ];

  return {
    isAyushEncounter: true,
    vataPct,
    pittaPct,
    kaphaPct,
    dominantDosha,
    prakritiLabel: prakriti ? prakriti.toUpperCase() : "EVALUATED FROM PARIKSHA",
    agniType,
    agniDescription,
    koshthaType,
    koshthaDescription,
    sattvaLevel,
    dhatuSara,
    lifestyleFactors,
    clinicalInsights,
  };
}
