/**
 * Clinical Reference Range Evaluator & Drug Interaction Checker for MediKiosk
 * Module B: Medical Document Digitization & Clinical Intelligence
 * Compliance: Standard Clinical Reference Boundaries (AIIMS / ICMR / Harrison's Internal Medicine)
 */

export type LabAlert = {
  testName: string;
  value: string;
  numericValue: number;
  unit: string;
  referenceRange: string;
  status: "HIGH" | "LOW" | "CRITICAL_HIGH" | "CRITICAL_LOW";
  severity: "urgent" | "warning";
  interpretation: string;
  sourceDoc?: string;
};

export type DrugAlert = {
  title: string;
  severity: "urgent" | "warning";
  detail: string;
  drugsInvolved: string[];
};

export type ClinicalAbnormalitiesResult = {
  labAlerts: LabAlert[];
  drugAlerts: DrugAlert[];
  hasUrgentFindings: boolean;
};

interface ReferenceRangeRule {
  keywords: string[];
  unit: string;
  minNormal: number;
  maxNormal: number;
  criticalLow?: number;
  criticalHigh?: number;
  lowLabel: string;
  highLabel: string;
}

const LAB_RULES: ReferenceRangeRule[] = [
  {
    keywords: ["fasting blood sugar", "fbs", "fasting glucose", "glucose fasting", "blood sugar fasting"],
    unit: "mg/dL",
    minNormal: 70,
    maxNormal: 100,
    criticalLow: 60,
    criticalHigh: 250,
    lowLabel: "Hypoglycemia risk",
    highLabel: "Elevated Fasting Glucose (Diabetic range if ≥126)",
  },
  {
    keywords: ["post prandial", "ppbs", "random blood sugar", "rbs", "blood sugar random", "glucose random", "glucose post prandial"],
    unit: "mg/dL",
    minNormal: 70,
    maxNormal: 140,
    criticalHigh: 300,
    lowLabel: "Low Blood Glucose",
    highLabel: "Elevated Random Glucose (≥200 indicates Diabetes)",
  },
  {
    keywords: ["hba1c", "glycated hemoglobin", "glycosylated hemoglobin"],
    unit: "%",
    minNormal: 4.0,
    maxNormal: 5.6,
    criticalHigh: 10.0,
    lowLabel: "Low HbA1c",
    highLabel: "Elevated HbA1c (≥6.5% Diagnostic for Diabetes)",
  },
  {
    keywords: ["hemoglobin", "hb", "haemoglobin", "hgb"],
    unit: "g/dL",
    minNormal: 12.0,
    maxNormal: 17.0,
    criticalLow: 8.0,
    lowLabel: "Low Hemoglobin (Anemia)",
    highLabel: "Polycythemia / Elevated Hemoglobin",
  },
  {
    keywords: ["serum creatinine", "creatinine", "s. creatinine"],
    unit: "mg/dL",
    minNormal: 0.6,
    maxNormal: 1.2,
    criticalHigh: 3.0,
    lowLabel: "Low Creatinine",
    highLabel: "Elevated Creatinine (Renal Impairment Alert)",
  },
  {
    keywords: ["systolic bp", "systolic blood pressure", "bp systolic", "systolic"],
    unit: "mmHg",
    minNormal: 90,
    maxNormal: 120,
    criticalHigh: 180,
    lowLabel: "Hypotension",
    highLabel: "Elevated Systolic BP (Hypertension Stage ≥2 if >140)",
  },
  {
    keywords: ["diastolic bp", "diastolic blood pressure", "bp diastolic", "diastolic"],
    unit: "mmHg",
    minNormal: 60,
    maxNormal: 80,
    criticalHigh: 120,
    lowLabel: "Low Diastolic BP",
    highLabel: "Elevated Diastolic BP (Hypertension if >90)",
  },
  {
    keywords: ["total leukocyte count", "tlc", "wbc", "white blood cell count", "wbc count"],
    unit: "/µL",
    minNormal: 4000,
    maxNormal: 11000,
    criticalLow: 2500,
    criticalHigh: 25000,
    lowLabel: "Leukopenia (Immunosuppression risk)",
    highLabel: "Leukocytosis (Acute Infection / Inflammation)",
  },
  {
    keywords: ["platelet count", "platelets", "total platelet count"],
    unit: "Lakhs/µL",
    minNormal: 1.5,
    maxNormal: 4.5,
    criticalLow: 0.5,
    lowLabel: "Thrombocytopenia (Bleeding risk)",
    highLabel: "Thrombocytosis",
  },
  {
    keywords: ["total cholesterol", "cholesterol", "serum cholesterol"],
    unit: "mg/dL",
    minNormal: 125,
    maxNormal: 200,
    criticalHigh: 300,
    lowLabel: "Low Cholesterol",
    highLabel: "Hypercholesterolemia (High Cardiovascular Risk)",
  },
  {
    keywords: ["serum bilirubin", "total bilirubin", "bilirubin total", "s. bilirubin"],
    unit: "mg/dL",
    minNormal: 0.2,
    maxNormal: 1.2,
    criticalHigh: 5.0,
    lowLabel: "Normal Bilirubin",
    highLabel: "Hyperbilirubinemia (Jaundice Alert)",
  },
  {
    keywords: ["serum uric acid", "uric acid", "s. uric acid"],
    unit: "mg/dL",
    minNormal: 3.5,
    maxNormal: 7.2,
    criticalHigh: 10.0,
    lowLabel: "Low Uric Acid",
    highLabel: "Hyperuricemia (Gout / Nephrolithiasis risk)",
  },
  {
    keywords: ["sgot", "ast", "aspartate aminotransferase"],
    unit: "U/L",
    minNormal: 10,
    maxNormal: 40,
    criticalHigh: 200,
    lowLabel: "Normal SGOT",
    highLabel: "Elevated SGOT / AST (Hepatic / Myocardial stress)",
  },
  {
    keywords: ["sgpt", "alt", "alanine aminotransferase"],
    unit: "U/L",
    minNormal: 10,
    maxNormal: 45,
    criticalHigh: 200,
    lowLabel: "Normal SGPT",
    highLabel: "Elevated SGPT / ALT (Hepatic Injury / Fatty Liver)",
  },
  {
    keywords: ["tsh", "thyroid stimulating hormone", "serum tsh"],
    unit: "mIU/L",
    minNormal: 0.4,
    maxNormal: 4.5,
    criticalHigh: 20.0,
    lowLabel: "Low TSH (Possible Hyperthyroidism)",
    highLabel: "High TSH (Hypothyroidism Alert)",
  },
];

/**
 * Extracts numeric value from a string like "186 mg/dL", "9.2 g/dl", "140/90"
 */
function parseNumericValue(valStr: string): number | null {
  if (!valStr) return null;
  const match = valStr.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  return isNaN(num) ? null : num;
}

/**
 * Checks if test name matches any known reference rule
 */
function findMatchingRule(testName: string): ReferenceRangeRule | null {
  const normName = testName.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
  for (const rule of LAB_RULES) {
    for (const kw of rule.keywords) {
      if (normName.includes(kw) || kw.includes(normName)) {
        return rule;
      }
    }
  }
  return null;
}

/**
 * Evaluates an individual lab test name and value
 */
export function evaluateLabValue(testName: string, rawValue: string, sourceDoc?: string): LabAlert | null {
  const num = parseNumericValue(rawValue);
  if (num === null) return null;

  const rule = findMatchingRule(testName);
  if (!rule) return null;

  let status: LabAlert["status"] | null = null;
  let severity: LabAlert["severity"] = "warning";
  let interpretation = "";

  if (rule.criticalHigh && num >= rule.criticalHigh) {
    status = "CRITICAL_HIGH";
    severity = "urgent";
    interpretation = `CRITICAL: ${rule.highLabel}`;
  } else if (rule.criticalLow && num <= rule.criticalLow) {
    status = "CRITICAL_LOW";
    severity = "urgent";
    interpretation = `CRITICAL: ${rule.lowLabel}`;
  } else if (num > rule.maxNormal) {
    status = "HIGH";
    severity = "warning";
    interpretation = rule.highLabel;
  } else if (num < rule.minNormal) {
    status = "LOW";
    severity = "warning";
    interpretation = rule.lowLabel;
  }

  if (!status) return null;

  return {
    testName: testName.trim(),
    value: rawValue.trim(),
    numericValue: num,
    unit: rule.unit,
    referenceRange: `${rule.minNormal} – ${rule.maxNormal} ${rule.unit}`,
    status,
    severity,
    interpretation,
    sourceDoc,
  };
}

/**
 * Checks for known OPD drug interactions and duplicates
 */
export function checkDrugInteractions(medications: string[]): DrugAlert[] {
  const alerts: DrugAlert[] = [];
  const normMeds = medications.map((m) => m.toLowerCase());

  const nsaidList = ["ibuprofen", "diclofenac", "naproxen", "aceclofenac", "piroxicam", "ketorolac", "mefenamic"];
  const nsaidsPresent = normMeds.filter((m) => nsaidList.some((n) => m.includes(n)));
  if (nsaidsPresent.length > 1) {
    alerts.push({
      title: "Multiple NSAID Co-Prescription Alert",
      severity: "urgent",
      detail: `Patient is taking multiple NSAIDs (${nsaidsPresent.join(", ")}). High risk of peptic ulceration, GI bleeding, and acute renal impairment.`,
      drugsInvolved: nsaidsPresent,
    });
  }

  // Aspirin + NSAID interaction
  const hasAspirin = normMeds.some((m) => m.includes("aspirin") || m.includes("ecosprin"));
  if (hasAspirin && nsaidsPresent.length > 0) {
    alerts.push({
      title: "Aspirin + NSAID Interaction Warning",
      severity: "warning",
      detail: "Co-administration of Aspirin with other NSAIDs increases mucosal bleeding risk and reduces cardioprotective efficacy of low-dose aspirin.",
      drugsInvolved: ["Aspirin", ...nsaidsPresent],
    });
  }

  // ACE inhibitor + Potassium / Spironolactone
  const aceInhibitors = ["enalapril", "ramipril", "lisinopril", "telmisartan", "losartan"];
  const potassiumDrugs = ["spironolactone", "potassium chloride", "k-bind", "amiloride"];
  const hasAce = normMeds.filter((m) => aceInhibitors.some((a) => m.includes(a)));
  const hasK = normMeds.filter((m) => potassiumDrugs.some((k) => m.includes(k)));
  if (hasAce.length > 0 && hasK.length > 0) {
    alerts.push({
      title: "Hyperkalemia Alert (RAAS Inhibitor + Potassium Agent)",
      severity: "urgent",
      detail: `Combination of ${hasAce.join(", ")} with ${hasK.join(", ")} carries high risk of life-threatening hyperkalemia. Serum potassium monitoring indicated.`,
      drugsInvolved: [...hasAce, ...hasK],
    });
  }

  return alerts;
}

/**
 * Main evaluator across all encounter facts and OCR extractions
 */
export function evaluateEncounterAbnormalities(
  facts: Array<{ fact_type: string; value: Record<string, unknown> }>,
  documents: Array<{ id: string; original_filename: string }>,
  timeline: Array<{ event_type: string; data: Record<string, unknown>; document_id?: string }>
): ClinicalAbnormalitiesResult {
  const labAlerts: LabAlert[] = [];
  const meds: string[] = [];

  // 1. Scan clinical facts
  for (const fact of facts) {
    if (fact.fact_type === "current_medications") {
      const medName = String(fact.value.medication ?? fact.value.value ?? "");
      if (medName) meds.push(medName);
    }
    if (fact.fact_type === "investigation_results" || fact.fact_type === "lab_result" || fact.fact_type === "vitals") {
      const test = String(fact.value.test_name ?? fact.value.parameter ?? fact.fact_type);
      const val = String(fact.value.value ?? fact.value.result ?? "");
      const alert = evaluateLabValue(test, val);
      if (alert) labAlerts.push(alert);
    }
  }

  // 2. Scan timeline & OCR extraction artifacts
  for (const item of timeline) {
    if (item.event_type === "extraction" && item.data) {
      const structured = (item.data.structured_data as Record<string, unknown>) || {};
      const docName = documents.find((d) => d.id === item.document_id)?.original_filename;

      // Extract medications from OCR
      const ocrMeds = (structured.medications as Array<{ name?: string }>) || [];
      ocrMeds.forEach((m) => { if (m.name) meds.push(m.name); });

      // Extract lab/investigation values from OCR
      const ocrLabs = (structured.investigation_results as Array<{ test_name?: string; value?: string; unit?: string }>) ||
                      (structured.lab_results as Array<{ test_name?: string; value?: string; unit?: string }>) ||
                      (structured.investigations as Array<{ test?: string; value?: string }>) || [];

      for (const lab of ocrLabs) {
        const testName = lab.test_name ?? (lab as { test?: string }).test ?? "";
        const testVal = lab.value ?? "";
        if (testName && testVal) {
          const alert = evaluateLabValue(testName, testVal, docName);
          if (alert && !labAlerts.some((existing) => existing.testName === alert.testName && existing.value === alert.value)) {
            labAlerts.push(alert);
          }
        }
      }
    }
  }

  // 3. Evaluate drug interactions
  const uniqueMeds = Array.from(new Set(meds));
  const drugAlerts = checkDrugInteractions(uniqueMeds);

  const hasUrgentFindings = labAlerts.some((l) => l.severity === "urgent") || drugAlerts.some((d) => d.severity === "urgent");

  return {
    labAlerts,
    drugAlerts,
    hasUrgentFindings,
  };
}
