# Use the official Node.js image as the base image
FROM node:lts

# Install OpenTelemetry outside the app, in /otel
WORKDIR /otel
RUN npm install --omit=dev --quiet --no-save \
    @opentelemetry/api@latest \
    @opentelemetry/auto-instrumentations-node@latest

# Resolve the auto-instrumentation from /otel and load it at startup
ENV NODE_PATH=/otel/node_modules
ENV NODE_OPTIONS="--require @opentelemetry/auto-instrumentations-node/register"

# Exporters are disabled by default; enable them with OTEL_*_EXPORTER=otlp.
ENV OTEL_EXPORTER_OTLP_ENDPOINT=http://alloy:4318 \
    OTEL_METRICS_EXPORTER=none \
    OTEL_LOGS_EXPORTER=none \
    OTEL_TRACES_EXPORTER=none \
    OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf \
    OTEL_RESOURCE_ATTRIBUTES=deployment.environment.name=dev,service.name=agentv,service.namespace=agentv-ns,service.instance.id=agentv,service.version=1.0.0

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev --quiet

# Copy the rest of the application code
COPY public ./public
COPY server ./server
COPY data/dependencies.yaml ./data/dependencies.yaml

# Expose the port the app runs on
EXPOSE 8080

# Command to run the application
CMD ["node", "server/server.js"]
