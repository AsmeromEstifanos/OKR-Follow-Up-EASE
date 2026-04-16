export type AppProfileKey = "classic" | "ease-okr";

export type AppProfile = {
  key: AppProfileKey;
  showVentureTabs: boolean;
  labels: {
    ventureSingular: string;
    venturePlural: string;
    topLevelSingular: string;
    topLevelPlural: string;
    midLevelSingular: string;
    midLevelPlural: string;
    leafLevelSingular: string;
    leafLevelPlural: string;
  };
  codePrefixes: {
    midLevel: string;
    leafLevel: string;
  };
};

const CLASSIC_PROFILE: AppProfile = {
  key: "classic",
  showVentureTabs: true,
  labels: {
    ventureSingular: "Venture",
    venturePlural: "Ventures",
    topLevelSingular: "Position",
    topLevelPlural: "Positions",
    midLevelSingular: "Objective",
    midLevelPlural: "Objectives",
    leafLevelSingular: "Key Result",
    leafLevelPlural: "Key Results"
  },
  codePrefixes: {
    midLevel: "OBJ",
    leafLevel: "KR"
  }
};

const EASE_OKR_PROFILE: AppProfile = {
  key: "ease-okr",
  showVentureTabs: false,
  labels: {
    ventureSingular: "Venture",
    venturePlural: "Ventures",
    topLevelSingular: "Objective",
    topLevelPlural: "Objectives",
    midLevelSingular: "Key Result",
    midLevelPlural: "Key Results",
    leafLevelSingular: "KPI",
    leafLevelPlural: "KPIs"
  },
  codePrefixes: {
    midLevel: "OBJ",
    leafLevel: "KPI"
  }
};

function normalizeProfileKey(value: string | undefined): AppProfileKey {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "ease-okr" ? "ease-okr" : "classic";
}

export function getAppProfile(): AppProfile {
  const profileKey = normalizeProfileKey(process.env.NEXT_PUBLIC_APP_PROFILE);
  return profileKey === "ease-okr" ? EASE_OKR_PROFILE : CLASSIC_PROFILE;
}

export const appProfile = getAppProfile();
