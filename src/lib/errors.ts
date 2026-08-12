export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly errors?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function badRequest(message = "Bad request", errors?: unknown): ApiError {
  return new ApiError(400, message, errors);
}

export function unauthorized(message = "Unauthorized"): ApiError {
  return new ApiError(401, message);
}

export function forbidden(message = "Forbidden"): ApiError {
  return new ApiError(403, message);
}

export function notFound(message = "Not found"): ApiError {
  return new ApiError(404, message);
}

export function conflict(message = "Conflict"): ApiError {
  return new ApiError(409, message);
}

export function tooMany(message = "Too many requests"): ApiError {
  return new ApiError(429, message);
}

export function unprocessable(message = "Unprocessable entity"): ApiError {
  return new ApiError(422, message);
}
