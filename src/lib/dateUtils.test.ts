import { describe, it, expect } from "vitest";
import { isOverdue } from "./dateUtils";

describe("dateUtils.isOverdue", () => {
  it("returns false when due date is null", () => {
    expect(isOverdue(null, false)).toBe(false);
  });

  it("returns false when ticket is completed", () => {
    const past = new Date(Date.now() - 1000 * 60 * 60).toISOString();
    expect(isOverdue(past, true)).toBe(false);
  });

  it("returns true when due date is in the past and not completed", () => {
    const past = new Date(Date.now() - 1000 * 60 * 60).toISOString();
    expect(isOverdue(past, false)).toBe(true);
  });

  it("returns false when due date is in the future", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60).toISOString();
    expect(isOverdue(future, false)).toBe(false);
  });
});