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

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev --quiet

# Copy the rest of the application code
COPY public ./public
COPY server ./server
COPY data/dependencies.yaml ./data/dependencies.yaml

# Expose the port the app runs on
EXPOSE 8080

# Command to run the application
CMD ["node", "server/server.js"]
