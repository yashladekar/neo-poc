import { Module } from "@nestjs/common"
import { IntegrationsModule } from "../integrations/integrations.module"
import { InternalController } from "./internal.controller"
import { InternalTokenGuard } from "./internal-token.guard"
import { InternalService } from "./internal.service"

@Module({
  imports: [IntegrationsModule],
  controllers: [InternalController],
  providers: [InternalService, InternalTokenGuard],
})
export class InternalModule {}
