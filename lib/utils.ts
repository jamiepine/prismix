// given an array of type constructors, is the value one of them?
export function valueIs(value: any, types: any[]) {
  return types.map((type) => type.name.toLowerCase() == typeof value).includes(true);
}
