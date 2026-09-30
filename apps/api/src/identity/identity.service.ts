import { Injectable } from "@nestjs/common"
import type { SessionUser } from "@workspace/contracts"
import bcrypt from "bcryptjs"
import { PrismaService } from "../prisma/prisma.service"

@Injectable()
export class IdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async getSessionUser(userId: string): Promise<SessionUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: { include: { group: true } } },
    })
    if (!user || !user.active) {
      return null
    }
    return this.toSessionUser(user)
  }

  async validateCredentials(email: string, password: string): Promise<SessionUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { memberships: { include: { group: true } } },
    })
    if (!user || !user.active) {
      return null
    }
    const passwordMatches = await bcrypt.compare(password, user.passwordHash)
    if (!passwordMatches) {
      return null
    }
    return this.toSessionUser(user)
  }

  listGroups() {
    return this.prisma.group.findMany({
      orderBy: { key: "asc" },
      select: { id: true, key: true, name: true, description: true, permissions: true },
    })
  }

  listUsers() {
    return this.prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        memberships: { select: { group: { select: { key: true } } } },
      },
    })
  }

  private toSessionUser(user: {
    id: string
    email: string
    name: string
    memberships: { group: { key: string; permissions: string[] } }[]
  }): SessionUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      groups: user.memberships.map((membership) => membership.group.key).sort(),
      permissions: Array.from(
        new Set(user.memberships.flatMap((membership) => membership.group.permissions)),
      ).sort(),
    }
  }
}
