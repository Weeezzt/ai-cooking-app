import { describe, expect, it } from "vitest";

import {
  DEFAULT_FORM_VALUES,
  fullVibe,
  hasAllergyText,
  nextDistanceRung,
  perPortionCaption,
  tightBudgetHint,
  toRequestBody,
} from "@/lib/planForm";
import { composeVibe, detectAllergy, emphasisedMacro } from "@/lib/vibe";

const sv = (value: string | null | undefined) => value?.replace(/\u00a0/gu, " ");

describe("emphasisedMacro", () => {
  it("reads the macro the user's own words emphasised", () => {
    expect(emphasisedMacro("gärna högt protein")).toBe("protein");
    expect(emphasisedMacro("lågkolhydrat, gärna LCHF")).toBe("carbs");
    expect(emphasisedMacro("mycket fett tack")).toBe("fat");
  });

  it("emphasises nothing rather than guessing", () => {
    expect(emphasisedMacro("något mysigt")).toBeNull();
    expect(emphasisedMacro("")).toBeNull();
  });
});

describe("detectAllergy", () => {
  it("is deliberately generous — a false negative would be a safety claim", () => {
    for (const text of [
      "nötallergi",
      "jag är laktosintolerant",
      "tål inte gluten",
      "celiaki",
      "glutenfritt tack",
    ]) {
      expect(detectAllergy(text)).toBe(true);
    }
  });

  it("does not fire on ordinary dislikes", () => {
    expect(detectAllergy("jag ogillar koriander")).toBe(false);
  });
});

describe("composeVibe", () => {
  it("phrases dislikes as an exclusion the model can read", () => {
    expect(composeVibe("Fräscht och asiatiskt", "koriander")).toBe(
      "Fräscht och asiatiskt. Undvik: koriander",
    );
  });

  it("drops the empty half", () => {
    expect(composeVibe("Fräscht", "")).toBe("Fräscht");
    expect(composeVibe("", "skaldjur")).toBe("Undvik: skaldjur");
  });
});

describe("toRequestBody", () => {
  it("maps the form to the POST /api/plan contract", () => {
    const body = toRequestBody(
      {
        ...DEFAULT_FORM_VALUES,
        location: " Umeå ",
        dietary: ["vegetarian"],
        pantry: ["salt", "ris"],
      },
      2,
    );
    expect(body).toMatchObject({
      location: "Umeå",
      budgetSek: "300",
      portions: 4,
      maxDistanceKm: 5,
      maxCookMinutes: 40,
      attempt: 2,
    });
    expect(body.dietary).toEqual([
      { id: "vegetarian", label: "Vegetariskt", safetyCritical: false },
    ]);
    expect(body.pantry).toEqual([
      { raw: "Salt", concept: "salt" },
      { raw: "Ris", concept: "ris" },
    ]);
  });

  it("sends an empty location as null so demo mode can label its default", () => {
    expect(toRequestBody({ ...DEFAULT_FORM_VALUES, location: "  " }, 0).location).toBeNull();
  });

  it("adds a safety-critical dietary constraint when the prose mentions an allergy", () => {
    const body = toRequestBody({ ...DEFAULT_FORM_VALUES, dislikes: "skaldjursallergi" }, 0);
    expect(body.dietary).toContainEqual({
      id: "allergy_freetext",
      label: "Allergi angiven i fritext",
      safetyCritical: true,
    });
    expect(body.vibe).toContain("Undvik: skaldjursallergi");
  });
});

describe("input-screen captions", () => {
  it("derives the per-portion budget live", () => {
    expect(sv(perPortionCaption(DEFAULT_FORM_VALUES))).toBe("≈ 75 kr/portion");
  });

  it("hints at a tight budget without blocking generation", () => {
    expect(tightBudgetHint(DEFAULT_FORM_VALUES)).toBeNull();
    expect(sv(tightBudgetHint({ ...DEFAULT_FORM_VALUES, budgetSek: "80" }))).toContain(
      "20 kr/portion är tajt",
    );
  });

  it("treats a safety-critical dietary toggle as allergy text too", () => {
    expect(hasAllergyText(DEFAULT_FORM_VALUES)).toBe(false);
    expect(hasAllergyText({ ...DEFAULT_FORM_VALUES, dietary: ["gluten_free"] })).toBe(true);
  });

  it("keeps the two prose fields as one vibe string", () => {
    expect(fullVibe({ ...DEFAULT_FORM_VALUES, dislikes: "lök" })).toContain("Undvik: lök");
  });
});

describe("nextDistanceRung", () => {
  it("offers the next rung, never applies it", () => {
    expect(nextDistanceRung("2")).toBe("5");
    expect(nextDistanceRung("5")).toBe("10");
  });

  it("returns null at the top rung", () => {
    expect(nextDistanceRung("10")).toBeNull();
  });
});
