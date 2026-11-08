const express = require('express');
const bodyParser = require('body-parser');
const path = require('node:path');
const http = require('node:http');
const WebSocket = require('ws');
const swaggerJsdoc = require('swagger-jsdoc');
const logger = require('./logger');
const liveReload = require('./livereload');
const {name, version} = require('../package.json');
const {createServices} = require('./services');

const PUBLIC_DIR = path.join(__dirname, '../public');
const SWAGGER_UI_DIR = path.join(__dirname, 'swagger-ui');

async function createServer({tracker, dataFile} = {}) {
    const app = express();
    const uiConfig = {
        name: process.env.APP_NAME || name,
        theme: process.env.THEME ?? process.env.theme ?? 'main-dark-green'
    };
    const apiDocs = swaggerJsdoc({
        failOnErrors: true,
        definition: {openapi: '3.0.3', info: {title: uiConfig.name, version}},
        apis: [path.join(__dirname, '**/*.js')]
    });
    const httpServer = http.createServer(app);
    const wss = new WebSocket.Server({server: httpServer, path: '/websocket'});
    const broadcast = data => {
        const body = JSON.stringify(data);
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) client.send(body);
        });
    };

    let services;
    try {
        services = await createServices({tracker, dataFile, broadcast});
    } catch (error) {
        wss.close();
        throw error;
    }

    app.use(bodyParser.json());
    liveReload.attach(app, PUBLIC_DIR);
    app.use(express.static(PUBLIC_DIR));

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
    app.get('/uiconfig', (req, res) => res.json(uiConfig));
    app.get('/v3/api-docs', (req, res) => res.json(apiDocs));
    app.use('/swagger-ui',
        express.static(SWAGGER_UI_DIR),
        express.static(require('swagger-ui-dist').getAbsoluteFSPath())
    );
    app.get('/swagger-ui.html', (req, res) => {
        res.sendFile(path.join(SWAGGER_UI_DIR, 'index.html'));
    });

    app.use(services.router);
    wss.on('connection', services.onConnection);
    app.use((error, req, res, next) => {
        logger.error({err: error}, 'Request failed');
        if (res.headersSent) return next(error);
        res.status(error.status || 500).json({error: error.message});
    });

    return {app, server: httpServer, wss, tracker: services.tracker};
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
