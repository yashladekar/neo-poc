# syntax=docker/dockerfile:1

# Build stage: Maven + JDK 21 (Flowable 7.x / Spring Boot 3.5 baseline).
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml .
COPY src ./src
RUN mvn -B -DskipTests package

# Runtime stage: slim JRE 21.
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /workspace/target/*.jar app.jar
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
