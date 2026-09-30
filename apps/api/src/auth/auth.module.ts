import { Global, Module } from "@nestjs/common"
import { JwtModule } from "@nestjs/jwt"
import { ENV } from "../config/config.module"
import type { Env } from "../config/env"
import { IdentityModule } from "../identity/identity.module"
import { AuthController } from "./auth.controller"
import { AuthService } from "./auth.service"
import { JwtAuthGuard } from "./jwt-auth.guard"
import { PermissionsGuard } from "./permissions.guard"

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        secret: env.JWT_SECRET,
        signOptions: { expiresIn: env.JWT_EXPIRES_IN_SECONDS },
      }),
    }),
    IdentityModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, PermissionsGuard],
  exports: [JwtModule, AuthService, JwtAuthGuard, PermissionsGuard],
})
export class AuthModule {}
