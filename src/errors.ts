export class ErrorOccuredAndReverted extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErrorOccuredAndReverted";
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
