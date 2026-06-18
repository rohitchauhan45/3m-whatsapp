export class AppError extends Error {
  public HTTPStatus: number;
  public isTrusted: boolean;
  public cause?: unknown;

  constructor(
    name: string,
    message: string,
    HTTPStatus = 500,
    isTrusted = true,
    cause?: unknown,
  ) {
    super(message);
    this.name = name;
    Object.setPrototypeOf(this, new.target.prototype);
    this.HTTPStatus = HTTPStatus;
    this.isTrusted = isTrusted;
    this.cause = cause;
  }
}
