import { describe, expect, it, vi } from "vitest";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

vi.mock("../app/shopify.server", () => ({ unauthenticated: { admin: vi.fn() }, authenticate: {} }));

// Every structured answer we ask Claude for must convert to an output format (no enums/transforms).
describe("Claude output formats", async () => {
  const onboarding = await import("../app/lib/onboarding.server");
  const parse = await import("../app/lib/parse.server");
  const fixes = await import("../app/lib/fixes.server");
  const outreach = await import("../app/lib/outreach.server");
  const schemas = {
    ProfileSchema: onboarding.ProfileSchema,
    QuestionsSchema: onboarding.QuestionsSchema,
    ParseSchema: parse.ParseSchema,
    IdeasSchema: fixes.IdeasSchema,
    ProductWriteSchema: fixes.ProductWriteSchema,
    GuideSchema: fixes.GuideSchema,
    ClaimsSchema: fixes.ClaimsSchema,
    PitchSchema: outreach.PitchSchema,
  };
  for (const [name, schema] of Object.entries(schemas)) {
    it(name, () => {
      const format = betaZodOutputFormat(schema) as unknown as { schema: object };
      expect(format.schema).toHaveProperty("type", "object");
    });
  }
});
