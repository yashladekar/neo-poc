import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common"
import { Prisma } from "@prisma/client"
import type { IntegrationLog as IntegrationLogDto } from "@workspace/contracts"
import { AuditService } from "../audit/audit.service"
import { PrismaService } from "../prisma/prisma.service"
import {
  TRAVEL_BOOKING_PROVIDER,
  type TravelBookingProvider,
} from "./travel-booking.provider"

export interface BookingConfirmation {
  bookingReference: string
}

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(TRAVEL_BOOKING_PROVIDER) private readonly booking: TravelBookingProvider,
  ) {}

  /**
   * Confirms travel with the booking provider once a request is approved.
   * Idempotent: an already-booked request returns its existing reference, so a
   * retried service task cannot double-book.
   */
  async confirmBooking(requestId: string): Promise<BookingConfirmation> {
    const request = await this.prisma.travelRequest.findUnique({ where: { id: requestId } })
    if (!request) {
      throw new NotFoundException("Travel request not found")
    }
    if (request.bookingReference) {
      return { bookingReference: request.bookingReference }
    }

    const requestPayload = {
      requestId,
      destination: request.destination,
      startDate: request.startDate.toISOString().slice(0, 10),
      endDate: request.endDate.toISOString().slice(0, 10),
      amount: Number(request.totalAmount),
      currency: request.currency,
    }
    const startedAt = Date.now()

    try {
      const result = await this.booking.book(requestPayload)
      await this.prisma.integrationLog.create({
        data: {
          requestId,
          provider: result.provider,
          operation: "BOOK_TRAVEL",
          status: "SUCCESS",
          requestPayload: requestPayload as Prisma.InputJsonValue,
          responsePayload: { reference: result.reference } as Prisma.InputJsonValue,
          durationMs: Date.now() - startedAt,
        },
      })
      await this.prisma.travelRequest.update({
        where: { id: requestId },
        data: { bookingReference: result.reference },
      })
      await this.audit.record({
        entityType: "TravelRequest",
        entityId: requestId,
        requestId,
        action: "INTEGRATION_BOOKING_CONFIRMED",
        data: { provider: result.provider, reference: result.reference },
      })
      return { bookingReference: result.reference }
    } catch (error) {
      const message = (error as Error).message
      this.logger.error(`Booking integration failed for ${requestId}: ${message}`)
      await this.prisma.integrationLog.create({
        data: {
          requestId,
          provider: "travel-booking",
          operation: "BOOK_TRAVEL",
          status: "FAILED",
          requestPayload: requestPayload as Prisma.InputJsonValue,
          error: message.slice(0, 1000),
          durationMs: Date.now() - startedAt,
        },
      })
      throw error
    }
  }

  async listForRequest(requestId: string): Promise<IntegrationLogDto[]> {
    const logs = await this.prisma.integrationLog.findMany({
      where: { requestId },
      orderBy: { createdAt: "asc" },
    })
    return logs.map((log) => ({
      id: log.id,
      provider: log.provider,
      operation: log.operation,
      status: log.status === "SUCCESS" ? "SUCCESS" : "FAILED",
      durationMs: log.durationMs,
      error: log.error,
      createdAt: log.createdAt.toISOString(),
    }))
  }
}
