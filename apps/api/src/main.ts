import "dotenv/config"
import "reflect-metadata"
import { NestFactory } from "@nestjs/core"
import cookieParser from "cookie-parser"
import { AppModule } from "./app.module"
import { loadEnv } from "./config/env"

async function bootstrap(): Promise<void> {
  const env = loadEnv()
  const app = await NestFactory.create(AppModule)
  app.use(cookieParser())
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true })
  app.setGlobalPrefix("api")
  await app.listen(env.PORT)
}

void bootstrap()
