/** BrandProfile stores `colors` and `productsServices` as Prisma `Json`
 * columns, so reading them back gives an unknown-shaped JsonValue rather
 * than a typed array - this narrows it safely for callers that expect a
 * string list. */
export function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const strings = value.filter((item): item is string => typeof item === "string");
  return strings.length > 0 ? strings : null;
}
