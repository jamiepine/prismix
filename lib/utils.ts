// Given an array of type constructors, is the value one of them?
export function valueIs(value: unknown, types: unknown[]) {
  return types.some((type) => type.name.toLowerCase() === typeof value);
}
