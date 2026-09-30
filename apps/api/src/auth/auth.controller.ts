import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Res, UseGuards } from "@nestjs/common"
import type { LoginInput, SessionUser } from "@workspace/contracts"
import { loginSchema } from "@workspace/contracts"
import type { CookieOptions, Response } from "express"
import { CurrentUser } from "../common/current-user.decorator"
import { ZodValidationPipe } from "../common/zod-validation.pipe"
import { ENV } from "../config/config.module"
import type { Env } from "../config/env"
import { AuthService } from "./auth.service"
import { JwtAuthGuard } from "./jwt-auth.guard"
import { SESSION_COOKIE } from "./session"

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post("login")
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionUser> {
    const { token, user } = await this.auth.login(body.email, body.password)
    response.cookie(SESSION_COOKIE, token, this.cookieOptions())
    return user
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) response: Response): { ok: boolean } {
    response.clearCookie(SESSION_COOKIE, { path: "/" })
    return { ok: true }
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: SessionUser): SessionUser {
    return user
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: "lax",
      secure: this.env.NODE_ENV === "production",
      path: "/",
      maxAge: this.env.JWT_EXPIRES_IN_SECONDS * 1000,
    }
  }
}
