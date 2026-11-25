import regionData from "@/data/map-regions.json";

export type Region = { name: string; code: string };

const collator = new Intl.Collator("en", { sensitivity: "base" });

export const regions: Region[] = [...regionData].sort((a, b) =>
  collator.compare(a.name, b.name),
);

export const regionCodes = new Set(regions.map((region) => region.code));
