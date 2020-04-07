export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MalformedInputError';
  }
}
