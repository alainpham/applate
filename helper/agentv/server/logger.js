// JSON logs to stdout. When the OpenTelemetry auto-instrumentation is loaded
// (container image), trace_id/span_id are added and records are sent over OTLP.
const pino = require("pino");

module.exports = pino({ level: process.env.LOG_LEVEL || "info" });
