import { describe, expect, it } from "vitest";
import { REGION_TARGETS } from "./WorldMapGame";

describe("region target assignments", () => {
  it("assigns every explicit subregion ISO to exactly one subregion", () => {
    const assignments = new Map<string, string[]>();

    for (const target of REGION_TARGETS) {
      if (!target.isos) continue;

      for (const iso of target.isos) {
        const regions = assignments.get(iso) ?? [];
        regions.push(target.id);
        assignments.set(iso, regions);
      }
    }

    const malformed = Array.from(assignments.keys()).filter(
      (iso) => !/^[A-Z]{2}$/.test(iso),
    );
    const duplicates = Array.from(assignments.entries())
      .filter(([, regions]) => regions.length !== 1)
      .map(([iso, regions]) => `${iso}: ${regions.join(", ")}`);

    expect(malformed).toEqual([]);
    expect(duplicates).toEqual([]);
  });
});
