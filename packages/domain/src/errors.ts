export class DomainError extends Error {
  constructor(message: string, readonly code = "DOMAIN_ERROR") {
    super(message);
  }
}

export class InvariantError extends DomainError {
  constructor(message: string) {
    super(message, "INVARIANT_ERROR");
  }
}
