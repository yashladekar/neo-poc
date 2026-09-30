import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common"
import type { Request } from "express"
import { timingSafeEqual } from "node:crypto"
import { ENV } from "../config/config.module"
import type { Env } from "../config/env"

@Injectable()
export class InternalTokenGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    const provided = request.header("x-internal-token")
    if (!provided) {
      throw new UnauthorizedException("Missing internal service token")
    }
    const providedBuffer = Buffer.from(provided)
    const expectedBuffer = Buffer.from(this.env.WORKFLOW_INTERNAL_TOKEN)
    if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
      throw new UnauthorizedException("Invalid internal service token")
    }
    return true
  }
}
