import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common"
import { z } from "zod"
import { ZodValidationPipe } from "../common/zod-validation.pipe"
import { IntegrationsService } from "../integrations/integrations.service"
import { InternalTokenGuard } from "./internal-token.guard"
import { InternalService, REQUEST_EVENTS, type RequestEvent } from "./internal.service"

const eventSchema = z.object({
  event: z.enum(REQUEST_EVENTS),
})

const finalizeSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
})

/**
 * Callbacks from the Flowable workflow service. Authenticated with a shared
 * service token, never reachable from a browser.
 */
@Controller("internal")
@UseGuards(InternalTokenGuard)
export class InternalController {
  constructor(
    private readonly internal: InternalService,
    private readonly integrations: IntegrationsService,
  ) {}

  @Post("requests/:id/events")
  events(@Param("id") id: string, @Body(new ZodValidationPipe(eventSchema)) body: { event: RequestEvent }) {
    return this.internal.handleEvent(id, body.event)
  }

  @Post("requests/:id/policy")
  policy(@Param("id") id: string) {
    return this.internal.evaluatePolicy(id)
  }

  @Post("requests/:id/finalize")
  finalize(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(finalizeSchema)) body: { decision: "APPROVED" | "REJECTED" },
  ) {
    return this.internal.finalize(id, body.decision)
  }

  @Post("requests/:id/integrations/booking")
  booking(@Param("id") id: string) {
    return this.integrations.confirmBooking(id)
  }
}
