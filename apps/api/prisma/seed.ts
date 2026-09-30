import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const GROUPS = [
  {
    key: "employees",
    name: "Employees",
    description: "All staff who can raise travel requests",
    permissions: ["request:create", "request:read:own", "task:complete:employee"],
  },
  {
    key: "supervisors",
    name: "Supervisors",
    description: "Managers who approve team travel requests",
    permissions: ["request:read:all", "task:approve:manager"],
  },
  {
    key: "finance",
    name: "Finance",
    description: "Finance team who approve high-value requests",
    permissions: ["request:read:all", "task:approve:finance", "report:read"],
  },
]

const USERS = [
  { email: "employee1@neo.dev", name: "Erin Employee", password: "password", groups: ["employees"] },
  { email: "manager1@neo.dev", name: "Morgan Manager", password: "password", groups: ["employees", "supervisors"] },
  { email: "finance1@neo.dev", name: "Frankie Finance", password: "password", groups: ["finance"] },
]

async function main() {
  for (const group of GROUPS) {
    await prisma.group.upsert({
      where: { key: group.key },
      update: { name: group.name, description: group.description, permissions: group.permissions },
      create: group,
    })
  }

  const groupRows = await prisma.group.findMany()
  const groupIdByKey = new Map(groupRows.map((group) => [group.key, group.id]))

  for (const user of USERS) {
    const passwordHash = await bcrypt.hash(user.password, 10)
    const saved = await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, passwordHash },
      create: { email: user.email, name: user.name, passwordHash },
    })

    for (const key of user.groups) {
      const groupId = groupIdByKey.get(key)
      if (!groupId) continue
      await prisma.membership.upsert({
        where: { userId_groupId: { userId: saved.id, groupId } },
        update: {},
        create: { userId: saved.id, groupId },
      })
    }
  }

  console.log(`Seeded ${GROUPS.length} groups and ${USERS.length} users`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
