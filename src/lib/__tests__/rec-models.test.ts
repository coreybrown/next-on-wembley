import { describe, it, expect } from "vitest";
import {
  REC_MODELS,
  REC_MODEL_LABELS,
  REC_MODEL_BLURBS,
  REC_MODEL_TO_API_ID,
  isValidRecModel,
} from "@/lib/rec-models";

describe("REC_MODELS", () => {
  it("contains exactly haiku + sonnet", () => {
    expect(REC_MODELS).toEqual(["haiku", "sonnet"]);
  });
});

describe("REC_MODEL_TO_API_ID", () => {
  it("maps to exact Anthropic model strings (do not date-suffix)", () => {
    // These strings are load-bearing: the Anthropic skill warns to use them
    // verbatim and never append date suffixes from training-data recall.
    expect(REC_MODEL_TO_API_ID.haiku).toBe("claude-haiku-4-5");
    expect(REC_MODEL_TO_API_ID.sonnet).toBe("claude-sonnet-4-6");
  });
});

describe("labels & blurbs", () => {
  it("has a label and blurb for every model", () => {
    for (const m of REC_MODELS) {
      expect(REC_MODEL_LABELS[m]).toBeTruthy();
      expect(REC_MODEL_BLURBS[m]).toBeTruthy();
    }
  });
});

describe("isValidRecModel", () => {
  it("accepts known values", () => {
    expect(isValidRecModel("haiku")).toBe(true);
    expect(isValidRecModel("sonnet")).toBe(true);
  });
  it("rejects unknown values", () => {
    expect(isValidRecModel("opus")).toBe(false);
    expect(isValidRecModel("HAIKU")).toBe(false);
    expect(isValidRecModel("")).toBe(false);
  });
});
