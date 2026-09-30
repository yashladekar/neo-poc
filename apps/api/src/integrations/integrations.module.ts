import { Module } from "@nestjs/common"
import { RequestsModule } from "../requests/requests.module"
import { IntegrationsController } from "./integrations.controller"
import { IntegrationsService } from "./integrations.service"
import { MockTravelBookingProvider, TRAVEL_BOOKING_PROVIDER } from "./travel-booking.provider"

@Module({
  imports: [RequestsModule],
  controllers: [IntegrationsController],
  providers: [
    IntegrationsService,
    { provide: TRAVEL_BOOKING_PROVIDER, useClass: MockTravelBookingProvider },
  ],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
