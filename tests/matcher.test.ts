import { describe, expect, test } from "vitest";
import { evaluateMatch } from "@/lib/matcher";

describe("deterministic matching", () => {
  test("accepts an explicit official parent relationship", () => {
    const result = evaluateMatch({ explicitParent: "Document 112135 is under project 37100." });
    expect(result).toMatchObject({ linked: true, confidence: "verified" });
  });

  test("accepts multiple independent medium signals as reviewable", () => {
    const result = evaluateMatch({ compatibleChronology: true, distinctiveSubject: true, titleSimilarity: true });
    expect(result).toMatchObject({ linked: true, confidence: "strong_match" });
  });

  test("rejects a title-only false positive", () => {
    const result = evaluateMatch({ titleSimilarity: true });
    expect(result.linked).toBe(false);
    expect(result.reason).toMatch(/title or topic similarity alone/i);
  });
});
