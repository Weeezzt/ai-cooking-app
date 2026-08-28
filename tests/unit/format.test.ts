import { describe, expect, it } from "vitest";

import { formatNumber, formatQuantity, formatSek } from "@/lib/format";

const NBSP = " ";

describe("formatSek (öre → sv-SE kronor)", () => {
  it("formats a thousands amount with decimal comma and nbsp separators", () => {
    expect(formatSek(124_950)).toBe(`1${NBSP}249,50${NBSP}kr`);
  });

  it("omits decimals for a whole-krona amount by default", () => {
    expect(formatSek(45_000)).toBe(`450${NBSP}kr`);
  });

  it("forces decimals when asked", () => {
    expect(formatSek(45_000, { decimals: true })).toBe(`450,00${NBSP}kr`);
  });

  it("keeps decimals when the amount is not whole", () => {
    expect(formatSek(12_950, { unit: "kr/kg" })).toBe(`129,50${NBSP}kr/kg`);
  });

  it("never emits an ASCII space", () => {
    expect(formatSek(1_234_567).includes(" ")).toBe(false);
  });
});

describe("formatQuantity", () => {
  it.each([
    [450, "g", `450${NBSP}g`],
    [2.5, "dl", `2,5${NBSP}dl`],
    [18, "min", `18${NBSP}min`],
    [1000, "g", `1${NBSP}000${NBSP}g`],
  ])("formats %s %s", (value, unit, expected) => {
    expect(formatQuantity(value, unit)).toBe(expected);
  });
});

describe("formatNumber", () => {
  it("formats a bare Swedish number with no unit", () => {
    expect(formatNumber(1249.5)).toBe(`1${NBSP}249,5`);
  });
});
