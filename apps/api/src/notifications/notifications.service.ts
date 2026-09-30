import { Injectable } from "@nestjs/common"
import type { Notification as NotificationDto, NotificationList } from "@workspace/contracts"
import { PrismaService } from "../prisma/prisma.service"

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string): Promise<NotificationList> {
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      this.prisma.notification.count({ where: { userId, read: false } }),
    ])
    return { items: items.map(toNotificationDto), unread }
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, read: false } })
  }

  /** Compact state used by the live-update stream. */
  async snapshot(userId: string): Promise<{ unread: number; latestId: string | null }> {
    const [unread, latest] = await Promise.all([
      this.prisma.notification.count({ where: { userId, read: false } }),
      this.prisma.notification.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      }),
    ])
    return { unread, latestId: latest?.id ?? null }
  }

  async markRead(userId: string, id: string): Promise<{ ok: boolean }> {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { read: true } })
    return { ok: true }
  }

  async markAllRead(userId: string): Promise<{ ok: boolean }> {
    await this.prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } })
    return { ok: true }
  }
}

function toNotificationDto(notification: {
  id: string
  type: string
  title: string
  body: string
  read: boolean
  refType: string | null
  refId: string | null
  createdAt: Date
}): NotificationDto {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    read: notification.read,
    refType: notification.refType,
    refId: notification.refId,
    createdAt: notification.createdAt.toISOString(),
  }
}
