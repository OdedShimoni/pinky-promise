
export class PromiseFailedAndReverted extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromiseFailedAndReverted";
  }
}

export class FatalErrorNotReverted extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FatalErrorNotReverted";
  }
}

export class ProgrammerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProgrammerError";
  }
}

export class RetriesDidNotSucceed extends Error {
    constructor(message: string) {
        super(message);
        this.name = "RetriesDidNotSucceed";
    }
}

export class RevertError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RevertError";
  }
}

export class PromiseFailed extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromiseFailed";
  }
}

export function isPinkyPromiseError(error: Error): boolean {
  const allPinkyPromiseErrors = Object.values(module.exports as object)
    .filter(moduleExport => moduleExport?.name !== 'isPinkyPromiseError');

  return allPinkyPromiseErrors.some(pinkyPromiseError => error instanceof pinkyPromiseError);
}
