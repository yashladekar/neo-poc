import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import type { Request } from "express"
import { IdentityService } from "../identity/identity.service"
import { SESSION_COOKIE } from "./session"

interface SessionPayload {
  sub: string
  email: string
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly identity: IdentityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const token = request.cookies?.[SESSION_COOKIE] as string | undefined
    if (!token) {
      throw new UnauthorizedException("Not authenticated")
    }

    let payload: SessionPayload
    try {
      payload = await this.jwt.verifyAsync<SessionPayload>(token)
    } catch {
      throw new UnauthorizedException("Invalid or expired session")
    }

    const user = await this.identity.getSessionUser(payload.sub)
    if (!user) {
      throw new UnauthorizedException("User is no longer active")
    }
    request.user = user
    return true
  }
}
