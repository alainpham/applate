const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const logger = require('./logger');
const liveReload = require('./livereload');
const http = require('http');
const WebSocket = require("ws");
const {Tracker} = require('./tracker/tracker');
const {DATA_FILE} = require('./tracker/config');

async function createServer({tracker = new Tracker()} = {}) {
    const app = express();
    const PUBLIC_DIR = path.join(__dirname, "../public");
    const uiConfig = {
        name: process.env.APP_NAME || "agentv",
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

    app.get('/api/dependencies', (req, res) => {
        res.set('Cache-Control', 'no-store').json(tracker.snapshot());
    });

    app.post('/api/check', async (req, res) => {
        res.json(await tracker.check());
    });

    app.get('/api/config.yaml', (req, res) => {
        res.download(DATA_FILE, 'dependencies.yaml');
    });

    app.get("/v3/api-docs", (req, res) => {
        res.json({
            openapi: "3.0.3",
            info: {title: uiConfig.name, version: "1.0.0"},
            paths: {
                "/ping": {get: {responses: {"200": {description: "Service is available"}}}},
                "/uiconfig": {get: {responses: {"200": {description: "UI configuration"}}}},
                '/api/dependencies': {get: {responses: {'200': {description: 'Configured dependencies, current versions, check results and summary'}}}},
                '/api/check': {post: {description: 'Read current versions and check ecosyste.ms. Concurrent callers share one run.',
                    responses: {'200': {description: 'Completed version check; individual failures are reported per dependency'},
                        '500': {description: 'Configuration or report persistence failed'}}}},
                '/api/config.yaml': {get: {responses: {'200': {description: 'Download dependency configuration as YAML'}}}}
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

    wss.broadcast = function broadcastToView(data) {
        const stringBody = JSON.stringify(data);
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) client.send(stringBody);
        });
    };

    tracker.onChange = snapshot => wss.broadcast({metadata: {type: 'dependencies'}, data: snapshot});
    wss.on('connection', socket => socket.send(JSON.stringify({metadata: {type: 'dependencies'}, data: tracker.snapshot()})));
    app.use((error, req, res, next) => {
        logger.error({err: error}, 'Request failed');
        res.status(error.status || 500).json({error: error.message});
    });
    await tracker.initialize();
    return {app, server: httpServer, wss, tracker};
}

if (require.main === module) {
    createServer().then(({server, wss}) => {
        const port = Number(process.env.PORT || 8080);
        server.listen(port, () => logger.info(`Server is running on http://localhost:${port}`));
        const shutdown = () => {
            liveReload.closeStreams();
            wss.clients.forEach(client => client.terminate());
            wss.close();
            server.close(() => logger.info('Closed out remaining connections'));
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    }).catch(error => {
        logger.fatal({err: error}, 'Unable to start version tracker');
        process.exitCode = 1;
    });
}

module.exports = {createServer};
