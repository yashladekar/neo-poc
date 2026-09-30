import { Controller, Get, HttpCode, HttpStatus, Param, Post, Sse, UseGuards } from "@nestjs/common"
import type { MessageEvent } from "@nestjs/common"
import type { SessionUser } from "@workspace/contracts"
import { Observable, timer } from "rxjs"
import { switchMap } from "rxjs/operators"
import { CurrentUser } from "../common/current-user.decorator"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { PermissionsGuard } from "../auth/permissions.guard"
import { NotificationsService } from "./notifications.service"

const PUSH_INTERVAL_MS = 3000

@Controller("notifications")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: SessionUser) {
    return this.notifications.listForUser(user.id)
  }

  /**
   * Server-sent events carrying the notification state. Only emits when the state
   * actually changes, so the client can refresh its UI without polling itself.
   */
  @Sse("stream")
  stream(@CurrentUser() user: SessionUser): Observable<MessageEvent> {
    let lastRevision = ""
    return timer(0, PUSH_INTERVAL_MS).pipe(
      switchMap(async (): Promise<MessageEvent> => {
        const state = await this.notifications.snapshot(user.id)
        const revision = `${state.unread}:${state.latestId ?? ""}`
        const changed = revision !== lastRevision
        lastRevision = revision
        return { data: { ...state, changed } } as MessageEvent
      }),
    )
  }

  @Post("read-all")
  @HttpCode(HttpStatus.OK)
  readAll(@CurrentUser() user: SessionUser) {
    return this.notifications.markAllRead(user.id)
  }

  @Post(":id/read")
  @HttpCode(HttpStatus.OK)
  read(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    return this.notifications.markRead(user.id, id)
  }
}
