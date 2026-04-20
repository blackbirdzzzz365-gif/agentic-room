export function resolveActorFromKey(
  apiKey: string,
  keyMap: Record<string, string>
): string | null {
  return keyMap[apiKey] ?? null;
}
