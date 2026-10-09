import { z } from "zod";

// The Claude SDK can't enforce enums (or transforms) in structured output, so choice fields are
// plain strings described with their options, and `pick` maps unknown answers to a safe default.

export const oneOf = (values: readonly string[]) => z.string().describe(`One of: ${values.join(", ")}`);

export function pick<const T extends readonly string[]>(values: T, value: string, fallback: T[number]): T[number] {
  const clean = value.trim().toLowerCase();
  return (values as readonly string[]).includes(clean) ? (clean as T[number]) : fallback;
}
