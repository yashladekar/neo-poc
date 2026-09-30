import { Inject, Injectable, UnauthorizedException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import type { SessionUser } from "@workspace/contracts"
import { ENV } from "../config/config.module"
import type { Env } from "../config/env"
import { IdentityService } from "../identity/identity.service"

export interface LoginResult {
  token: string
  user: SessionUser
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly identity: IdentityService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.identity.validateCredentials(email, password)
    if (!user) {
      throw new UnauthorizedException("Invalid email or password")
    }
    const token = await this.jwt.signAsync({ sub: user.id, email: user.email })
    return { token, user }
  }
}
