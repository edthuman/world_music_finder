import regionData from "@/data/map-regions.json";

export type Region = { name: string; code: string };

const collator = new Intl.Collator("en", { sensitivity: "base" });

export const regions: Region[] = [...regionData].sort((a, b) =>
  collator.compare(a.name, b.name),
);

export const regionCodes = new Set(regions.map((region) => region.code));

/** The value if it is a non-empty list of valid region codes, otherwise null. */
export function parseRegionCodes(value: unknown) {
  return Array.isArray(value) &&
    value.length > 0 &&
    value.every((code) => typeof code === "string" && regionCodes.has(code))
    ? (value as string[])
    : null;
}
