# 构建上下文为 server/ 目录本身（CI: context=./server）。
FROM golang:1.26-alpine AS build
WORKDIR /src
ENV CGO_ENABLED=0 GOFLAGS=-trimpath
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -ldflags="-s -w" -o /out/server ./cmd/server

FROM alpine:3.22
ARG BUILD_TIME
ARG GIT_SHA
RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S app && adduser -S -G app app
ENV APP_BASE_DIR=/app \
    APP_TEMPLATE_DIR=/app/templates \
    APP_UPLOAD_DIR=/app/data/uploads \
    APP_LOG_DIR=/app/data/logs \
    APP_BUILD_TIME=$BUILD_TIME \
    APP_GIT_SHA=$GIT_SHA
WORKDIR /app
COPY --from=build /out/server /app/server
COPY templates /app/templates
RUN mkdir -p /app/data/uploads /app/data/logs && chown -R app:app /app/data
USER app
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=10 \
  CMD ["/app/server", "healthcheck"]
ENTRYPOINT ["/app/server"]
