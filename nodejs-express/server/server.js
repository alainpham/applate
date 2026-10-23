const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const axios = require('axios');
const logger = require('./logger');
const liveReload = require('./livereload');

// add the prometheus middleware to all routes
const app = express();
const PORT = 8080;
const PUBLIC_DIR = path.join(__dirname, "../public");

// Middleware
app.use(bodyParser.json());

liveReload.attach(app, PUBLIC_DIR); // dev only, no-op unless LIVERELOAD=1
app.use(express.static(PUBLIC_DIR)); // Serve static files


app.get("/ping", (req, res) => {
    logger.info("Received ping");
    res.status(200).json({ message: "pong" });
});

// Start the server
server = app.listen(PORT, () => {
    logger.info(`Server is running on http://localhost:${PORT}`);
});

//gracefull shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received.');
    liveReload.closeStreams();
    server.close(() => {
        logger.info('Closed out remaining connections');
        // Additional cleanup tasks go here
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT signal received.');
    liveReload.closeStreams();
    server.close(() => {
        logger.info('Closed out remaining connections');
        // Additional cleanup tasks go here
    });
});
