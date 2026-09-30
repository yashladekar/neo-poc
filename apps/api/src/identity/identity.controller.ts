import { Controller, Get, UseGuards } from "@nestjs/common"
import { RequirePermissions } from "../auth/permissions.decorator"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { PermissionsGuard } from "../auth/permissions.guard"
import { IdentityService } from "./identity.service"

@Controller("identity")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Get("groups")
  @RequirePermissions("request:read:all")
  groups() {
    return this.identity.listGroups()
  }

  @Get("users")
  @RequirePermissions("request:read:all")
  users() {
    return this.identity.listUsers()
  }
}
