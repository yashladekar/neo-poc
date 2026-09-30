import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import type { SessionUser } from "@workspace/contracts"
import type { Request } from "express"
import { PERMISSIONS_KEY } from "./permissions.decorator"

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required || required.length === 0) {
      return true
    }
    const request = context.switchToHttp().getRequest<Request>()
    const user = request.user as SessionUser | undefined
    if (!user) {
      return false
    }
    return required.every((permission) => user.permissions.includes(permission))
  }
}
