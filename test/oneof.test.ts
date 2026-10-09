import { expect, it } from "vitest";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { oneOf, pick } from "../app/lib/oneof";

it("choice fields convert to a Claude output format and parse forgivingly", () => {
  const values = ["high", "medium", "low"] as const;
  const format = betaZodOutputFormat(z.object({ impact: oneOf(values), n: z.number().int().nullable() })) as unknown as {
    parse: (s: string) => { impact: string; n: number | null };
  };
  const out = format.parse('{"impact":" HIGH","n":null}');
  expect(pick(values, out.impact, "medium")).toBe("high");
  expect(pick(values, "huge", "medium")).toBe("medium");
});
