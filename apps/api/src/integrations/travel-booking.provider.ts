import { Injectable, Logger } from "@nestjs/common"

export interface BookingInput {
  requestId: string
  destination: string
  startDate: string
  endDate: string
  amount: number
  currency: string
}

export interface BookingOutput {
  provider: string
  reference: string
}

/**
 * Port for the external travel-booking system (an Appian "Integration" object).
 * Secrets and transport live here in the application layer; the workflow engine
 * only ever sees the resulting booking reference.
 */
export interface TravelBookingProvider {
  book(input: BookingInput): Promise<BookingOutput>
}

export const TRAVEL_BOOKING_PROVIDER = "TRAVEL_BOOKING_PROVIDER"

@Injectable()
export class MockTravelBookingProvider implements TravelBookingProvider {
  private readonly logger = new Logger(MockTravelBookingProvider.name)

  async book(input: BookingInput): Promise<BookingOutput> {
    await new Promise((resolve) => setTimeout(resolve, 50))
    const reference = `BK-${input.requestId.replace(/-/g, "").slice(0, 8).toUpperCase()}`
    this.logger.log(`Booked ${input.destination} (${input.startDate}→${input.endDate}) as ${reference}`)
    return { provider: "mock-travel-booking", reference }
  }
}
