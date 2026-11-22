import regionData from "@/data/map-regions.json";

export type Region = { name: string; code: string };

export const regions: Region[] = regionData;

export const regionCodes = new Set(regions.map((region) => region.code));
