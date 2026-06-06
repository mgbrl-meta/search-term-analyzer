import type { GoogleOsSettings } from "./types";

export const DEFAULT_GOOGLE_OS_SETTINGS: GoogleOsSettings = {
  recoveryRoas: 3,
  targetRoas: 4,
  scaleRoas: 5,

  minSpendForAction: 300,
  zeroConversionPauseSpend: 2000,
  hardCutSpend: 2000,

  budgetBelow1Roas: 3000,
  budget1To2Roas: 5000,
  budget2To3Roas: 7500,
  budget3PlusRoas: 10000,
  budget4PlusRoas: 15000,
};
