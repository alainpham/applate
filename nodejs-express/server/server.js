const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const axios = require('axios');
const logger = require('./logger');
const liveReload = require('./livereload');
const http = require('http');
const WebSocket = require("ws");

// add the prometheus middleware to all routes
const app = express();
const PORT = 8080;
const PUBLIC_DIR = path.join(__dirname, "../public");
const uiConfig = {
    name: process.env.APP_NAME || "nodejs-express",
    theme: process.env.THEME ?? process.env.theme ?? "main-dark-green"
};

// Middleware
app.use(bodyParser.json());

liveReload.attach(app, PUBLIC_DIR); // dev only, no-op unless LIVERELOAD=1
app.use(express.static(PUBLIC_DIR)); // Serve static files

// add websocket
const httpServer = http.createServer(app);
const wss = new WebSocket.Server({server: httpServer, path: "/websocket"});


app.get("/uiconfig", (req, res) => {
    res.json(uiConfig);
});

app.get("/ping", (req, res) => {
    logger.info("Received ping");
    res.status(200).json({ message: "pong" });
});

app.post("/send-msg", (req, res) => {
    wss.broadcast({metadata: {type: "person"}, data: [req.body]});
    res.json(req.body);
});

app.get("/v3/api-docs", (req, res) => {
    res.json({
        openapi: "3.0.3",
        info: {title: uiConfig.name, version: "1.0.0"},
        paths: {
            "/ping": {get: {responses: {"200": {description: "Service is available"}}}},
            "/uiconfig": {get: {responses: {"200": {description: "UI configuration"}}}},
            "/send-msg": {post: {
                requestBody: {required: true, content: {"application/json": {schema: {type: "object"}}}},
                responses: {"200": {description: "Message broadcast to connected viewers"}}
            }}
        }
    });
});

app.use("/swagger-ui", express.static(require("swagger-ui-dist").getAbsoluteFSPath()));
app.get("/swagger-ui.html", (req, res) => {
    res.type("html").send(`<!doctype html>
<html><head><title>Swagger UI</title><link rel="stylesheet" href="/swagger-ui/swagger-ui.css"></head>
<body><div id="swagger-ui"></div><script src="/swagger-ui/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({url: "/v3/api-docs", dom_id: "#swagger-ui"});</script></body></html>`);
});

wss.broadcast = function broadcastToView(data){
    const stringBody = JSON.stringify(data);
    wss.clients.forEach(
        function each(client) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(stringBody);
            }
        }
    );
 }

// Start the server
const server = httpServer.listen(PORT, () => {
    logger.info(`Server is running on http://localhost:${PORT}`);
});

//gracefull shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received.');
    liveReload.closeStreams();
    wss.clients.forEach(client => client.terminate());
    wss.close();
    server.close(() => {
        logger.info('Closed out remaining connections');
        // Additional cleanup tasks go here
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT signal received.');
    liveReload.closeStreams();
    wss.clients.forEach(client => client.terminate());
    wss.close();
    server.close(() => {
        logger.info('Closed out remaining connections');
        // Additional cleanup tasks go here
    });
});
