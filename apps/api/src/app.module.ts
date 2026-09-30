import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { AuditModule } from "./audit/audit.module"
import { AttachmentsModule } from "./attachments/attachments.module"
import { AuthModule } from "./auth/auth.module"
import { AppConfigModule } from "./config/config.module"
import { IdentityModule } from "./identity/identity.module"
import { IntegrationsModule } from "./integrations/integrations.module"
import { InternalModule } from "./internal/internal.module"
import { NotificationsModule } from "./notifications/notifications.module"
import { OutboxModule } from "./outbox/outbox.module"
import { PrismaModule } from "./prisma/prisma.module"
import { ReconciliationModule } from "./reconciliation/reconciliation.module"
import { RequestsModule } from "./requests/requests.module"
import { TasksModule } from "./tasks/tasks.module"
import { WorkflowModule } from "./workflow/workflow.module"

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AppConfigModule,
    PrismaModule,
    AuditModule,
    WorkflowModule,
    OutboxModule,
    ReconciliationModule,
    IdentityModule,
    AuthModule,
    RequestsModule,
    TasksModule,
    NotificationsModule,
    IntegrationsModule,
    AttachmentsModule,
    InternalModule,
  ],
})
export class AppModule {}
