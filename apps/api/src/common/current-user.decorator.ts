import { createParamDecorator, type ExecutionContext } from "@nestjs/common"
import type { SessionUser } from "@workspace/contracts"
import type { Request } from "express"

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): SessionUser => {
  const request = context.switchToHttp().getRequest<Request>()
  return request.user as SessionUser
})
