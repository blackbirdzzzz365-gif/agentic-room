export type ActorIdentity = {
  actorId: string;
  actorRole?: string;
};

export type ApiKeyMap = Record<string, string | ActorIdentity>;

export function resolveActorIdentityFromKey(
  apiKey: string,
  keyMap: ApiKeyMap
): ActorIdentity | null {
  const identity = keyMap[apiKey];
  if (!identity) {
    return null;
  }

  return typeof identity === "string" ? { actorId: identity } : identity;
}

export function resolveActorFromKey(
  apiKey: string,
  keyMap: ApiKeyMap
): string | null {
  return resolveActorIdentityFromKey(apiKey, keyMap)?.actorId ?? null;
}
