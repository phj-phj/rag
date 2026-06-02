export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class BadRequestError extends AppError {
  constructor(message = '请求参数错误') {
    super(400, message, 'BAD_REQUEST')
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = '未登录或登录已过期') {
    super(401, message, 'UNAUTHORIZED')
  }
}

export class ForbiddenError extends AppError {
  constructor(message = '无权访问') {
    super(403, message, 'FORBIDDEN')
  }
}

export class NotFoundError extends AppError {
  constructor(message = '资源不存在') {
    super(404, message, 'NOT_FOUND')
  }
}
