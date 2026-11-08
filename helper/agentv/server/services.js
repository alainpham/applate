const express = require('express');
const logger = require('./logger');
const {Tracker} = require('./tracker/tracker');
const {DATA_FILE} = require('./tracker/config');

/**
 * @openapi
 * components:
 *   schemas:
 *     TrackerSnapshot:
 *       type: object
 *       required: [checking, dependencies, summary]
 *       properties:
 *         checking:
 *           type: boolean
 *         checkedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         sourceRoot:
 *           type: string
 *           nullable: true
 *         dependencies:
 *           type: array
 *           items:
 *             type: object
 *             description: Configuration, current and available versions, comparisons, errors and check timestamp.
 *         summary:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *             updates:
 *               type: integer
 *             errors:
 *               type: integer
 *             current:
 *               type: integer
 *             unchecked:
 *               type: integer
 *     Error:
 *       type: object
 *       required: [error]
 *       properties:
 *         error:
 *           type: string
 */
async function createServices({tracker = new Tracker(), dataFile = DATA_FILE, broadcast} = {}) {
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
    router.get('/ping', (req, res) => {
        logger.info('Received ping');
        res.json({message: 'pong'});
    });

    /**
     * @openapi
     * /api/dependencies:
     *   get:
     *     responses:
     *       '200':
     *         description: Configured dependencies, current versions, check results and summary
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/TrackerSnapshot'
     */
    router.get('/api/dependencies', (req, res) => {
        res.set('Cache-Control', 'no-store').json(tracker.snapshot());
    });

    /**
     * @openapi
     * /api/check:
     *   post:
     *     description: Read current versions and check ecosyste.ms. Concurrent callers share one run.
     *     responses:
     *       '200':
     *         description: Completed version check; individual failures are reported per dependency
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/TrackerSnapshot'
     *       '500':
     *         description: Configuration or report persistence failed
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    router.post('/api/check', async (req, res) => {
        res.set('Cache-Control', 'no-store').json(await tracker.check());
    });

    /**
     * @openapi
     * /api/config.yaml:
     *   get:
     *     responses:
     *       '200':
     *         description: Download dependency configuration as YAML
     *         content:
     *           application/yaml:
     *             schema:
     *               type: string
     */
    router.get('/api/config.yaml', (req, res) => {
        res.download(dataFile, 'dependencies.yaml');
    });

    await tracker.initialize();
    const message = snapshot => ({metadata: {type: 'dependencies'}, data: snapshot});
    tracker.onChange = snapshot => broadcast(message(snapshot));

    return {
        router,
        tracker,
        onConnection: socket => socket.send(JSON.stringify(message(tracker.snapshot())))
    };
}

module.exports = {createServices};
