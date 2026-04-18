export const PersonalFork_appName = "WorkoutThing";
export const PersonalFork_exportPrefix = "workoutthing";

const localPremiumScreens = new Set(["graphs", "musclesProgram", "musclesDay"]);
const localPremiumFeatures = new Set(["graphs", "muscles", "weekinsights", "platescalculator"]);

export function PersonalFork_unlocksLocalPremiumScreen(screen: string): boolean {
  return localPremiumScreens.has(screen);
}

export function PersonalFork_unlocksLocalPremiumFeature(feature: string): boolean {
  return localPremiumFeatures.has(feature.replace(/\s+/g, "").toLowerCase());
}

export function PersonalFork_unlocksLocalPremiumTopic(topic: string): boolean {
  return PersonalFork_unlocksLocalPremiumFeature(topic);
}
