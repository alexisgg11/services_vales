FROM eclipse-temurin:17-jdk AS build
WORKDIR /build
COPY .mvn/ .mvn/
COPY mvnw ./
COPY backend/ backend/
COPY frontend/ frontend/
RUN sed -i 's/\r$//' mvnw && sh ./mvnw -B -ntp -f backend/pom.xml clean package

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /build/backend/target/services-vales.jar ./services-vales.jar
ENV VALES_BIND_ADDRESS=0.0.0.0
USER 10001
ENTRYPOINT ["java", "-jar", "/app/services-vales.jar"]
