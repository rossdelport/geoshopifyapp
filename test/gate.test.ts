// The process-wide caps on open calls: the gate itself, Treg calls (tregCall) and Claude calls (askJson).

import { afterAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { envLimit, gate } from "../app/lib/gate";

vi.hoisted(() => {
  process.env.TREG_API_KEY = "test-token";
  process.env.ANTHROPIC_API_KEY = "test-key";
});

// No database here: costs are not logged.
vi.mock("../app/lib/cost.server", () => ({ recordCost: vi.fn(async () => {}) }));

// Claude: each call stays open a moment and counts how many are open at once.
const claude = vi.hoisted(() => ({ open: 0, mostOpen: 0 }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    beta = {
      messages: {
        parse: async () => {
          claude.mostOpen = Math.max(claude.mostOpen, ++claude.open);
          await new Promise((resolve) => setTimeout(resolve, 5));
          claude.open--;
          return { model: "claude-haiku-5-5", stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 5 }, parsed_output: { ok: true } };
        },
      },
    };
  },
}));

const tick = (ms = 2) => new Promise((resolve) => setTimeout(resolve, ms));

describe("gate", () => {
  it("never runs more than the cap at once, and runs the rest in order", async () => {
    const g = gate(() => 3);
    let open = 0;
    let most = 0;
    const order: number[] = [];
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        g.run(async () => {
          most = Math.max(most, ++open);
          await tick();
          open--;
          order.push(i);
        }),
      ),
    );
    expect(most).toBe(3);
    expect(order).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(g.stats()).toEqual({ open: 0, waiting: 0, mostOpen: 3 });
  });

  it("gives the slot back when a call fails", async () => {
    const g = gate(() => 1);
    await expect(g.run(async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    await expect(g.run(async () => "next")).resolves.toBe("next");
    expect(g.stats()).toMatchObject({ open: 0, waiting: 0 });
  });

  it("reads the cap from the environment, with a default for unset or bad values", () => {
    expect(envLimit("GATE_TEST_UNSET", 40)).toBe(40);
    process.env.GATE_TEST_CAP = "12";
    expect(envLimit("GATE_TEST_CAP", 40)).toBe(12);
    process.env.GATE_TEST_CAP = "0";
    expect(envLimit("GATE_TEST_CAP", 40)).toBe(40);
    process.env.GATE_TEST_CAP = "lots";
    expect(envLimit("GATE_TEST_CAP", 40)).toBe(40);
    delete process.env.GATE_TEST_CAP;
  });
});

describe("process-wide caps", () => {
  afterAll(() => {
    vi.unstubAllGlobals();
    delete process.env.TREG_MAX_OPEN;
    delete process.env.CLAUDE_MAX_OPEN;
  });

  it("keeps Treg calls under TREG_MAX_OPEN across two checks' worth of calls", async () => {
    let open = 0;
    let most = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        most = Math.max(most, ++open);
        await tick(5);
        open--;
        return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
      }),
    );
    process.env.TREG_MAX_OPEN = "7";
    const { tregCall, tregGate } = await import("../app/lib/treg.server");
    const check = () => Promise.all(Array.from({ length: 18 }, () => tregCall("test.endpoint", { body: { q: 1 } })));
    await Promise.all([check(), check()]);
    expect(most).toBe(7);
    expect(tregGate.stats()).toMatchObject({ open: 0, waiting: 0 });
  });

  it("keeps Claude calls under CLAUDE_MAX_OPEN", async () => {
    process.env.CLAUDE_MAX_OPEN = "4";
    const { askJson } = await import("../app/lib/ai.server");
    const ask = () => askJson({ schema: z.object({ ok: z.boolean() }), system: "s", prompt: "p", label: "parse-answer", style: false });
    const out = await Promise.all(Array.from({ length: 20 }, ask));
    expect(out.every((o) => o.ok)).toBe(true);
    expect(claude.mostOpen).toBe(4);
  });
});
