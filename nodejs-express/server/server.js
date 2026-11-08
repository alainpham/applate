const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const logger = require('./logger');
const liveReload = require('./livereload');
const http = require('http');
const WebSocket = require("ws");
const swaggerJsdoc = require("swagger-jsdoc");
const {version} = require("../package.json");
const {createServices} = require("./services");

// add the prometheus middleware to all routes
const app = express();
const PORT = 8080;
const PUBLIC_DIR = path.join(__dirname, "../public");
const uiConfig = {
    name: process.env.APP_NAME || "nodejs-express",
    theme: process.env.THEME ?? process.env.theme ?? "main-dark-green"
};
const apiDocs = swaggerJsdoc({
    failOnErrors: true,
    definition: {
        openapi: "3.0.3",
        info: {title: uiConfig.name, version}
    },
    apis: [path.join(__dirname, "**/*.js")]
});

// Middleware
app.use(bodyParser.json());

liveReload.attach(app, PUBLIC_DIR); // dev only, no-op unless LIVERELOAD=1
app.use(express.static(PUBLIC_DIR)); // Serve static files

// add websocket
const httpServer = http.createServer(app);
const wss = new WebSocket.Server({server: httpServer, path: "/websocket"});


/**
 * @openapi
 * /uiconfig:
 *   get:
 *     responses:
 *       '200':
 *         description: UI configuration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [name, theme]
 *               properties:
 *                 name:
 *                   type: string
 *                 theme:
 *                   type: string
 */
app.get("/uiconfig", (req, res) => {
    res.json(uiConfig);
});

app.get("/v3/api-docs", (req, res) => {
    res.json(apiDocs);
});

const SWAGGER_UI_DIR = path.join(__dirname, "swagger-ui");
app.use("/swagger-ui",
    express.static(SWAGGER_UI_DIR),
    express.static(require("swagger-ui-dist").getAbsoluteFSPath())
);
app.get("/swagger-ui.html", (req, res) => {
    res.sendFile(path.join(SWAGGER_UI_DIR, "index.html"));
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

app.use(createServices({broadcast: wss.broadcast}));

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
