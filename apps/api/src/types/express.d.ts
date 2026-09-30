import type { SessionUser } from "@workspace/contracts"

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser
    }
  }
}

export {}
