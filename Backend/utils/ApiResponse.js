// Mirrors the ApiResponse<T> wrapper convention used in BizExchange,
// so every endpoint returns a consistent { success, message, data } shape.
export class ApiResponse {
  constructor(success, message, data = null) {
    this.success = success;
    this.message = message;
    this.data = data;
  }

  static success(res, message, data = null, statusCode = 200) {
    return res.status(statusCode).json(new ApiResponse(true, message, data));
  }

  static error(res, message, statusCode = 400, data = null) {
    return res.status(statusCode).json(new ApiResponse(false, message, data));
  }
}
