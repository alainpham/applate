const express = require("express");
const logger = require("./logger");

function createServices({broadcast}) {
    const router = express.Router();

    /**
     * @openapi
     * /ping:
     *   get:
     *     responses:
     *       '200':
     *         description: Service is available
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               required: [message]
     *               properties:
     *                 message:
     *                   type: string
     *                   example: pong
     */
    router.get("/ping", (req, res) => {
        logger.info("Received ping");
        res.status(200).json({ message: "pong" });
    });

    /**
     * @openapi
     * /send-msg:
     *   post:
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             additionalProperties: true
     *     responses:
     *       '200':
     *         description: Message broadcast to connected viewers
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               additionalProperties: true
     */
    router.post("/send-msg", (req, res) => {
        broadcast({metadata: {type: "person"}, data: [req.body]});
        res.json(req.body);
    });

    return router;
}

module.exports = {createServices};
