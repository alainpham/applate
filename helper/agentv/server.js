const express = require('express');
const http = require('node:http');
const path = require('node:path');
const WebSocket = require('ws');
const { createArtifactStore } = require('./lib/artifact-store');
const { resolveArtifactVersions } = require('./lib/version-resolver');

const port = Number(process.env.PORT || 3001);

function createApp({ store = createArtifactStore(), broadcaster = () => {} } = {}) {
  const app = express();
  let refreshPromise = null;
  app.use(express.json({ limit: '32kb' }));
  app.use(express.static(path.join(__dirname, 'static')));

  app.get('/uiconfig', (_request, response) => response.json({ theme: 'main-dark-green' }));
  app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));

  app.get('/api/artifacts', (_request, response) => response.json(store.list()));

  app.post('/api/artifacts/refresh', (_request, response) => {
    if (refreshPromise) return response.status(202).json({ status: 'already-running' });
    const artifacts = store.list();
    refreshPromise = refreshAll(artifacts, store, broadcaster)
      .catch((error) => console.error('Artifact refresh failed:', error))
      .finally(() => { refreshPromise = null; });
    return response.status(202).json({ status: 'started', count: artifacts.length });
  });

  app.get('/api/artifacts/:id', (request, response) => {
    const artifact = store.get(parseId(request.params.id));
    if (!artifact) return response.status(404).json({ error: 'Artifact not found' });
    return response.json(artifact);
  });

  app.post('/api/artifacts', (request, response) => {
    try {
      const artifact = store.create(request.body);
      broadcaster({ type: 'artifact.created', artifact });
      return response.status(201).json(artifact);
    } catch (error) {
      return response.status(400).json({ error: error.message });
    }
  });

  const updateArtifact = (request, response) => {
    try {
      const artifact = store.update(parseId(request.params.id), request.body);
      if (!artifact) return response.status(404).json({ error: 'Artifact not found' });
      broadcaster({ type: 'artifact.updated', artifact });
      return response.json(artifact);
    } catch (error) {
      return response.status(400).json({ error: error.message });
    }
  };
  app.put('/api/artifacts/:id', updateArtifact);
  app.patch('/api/artifacts/:id', updateArtifact);

  app.delete('/api/artifacts/:id', (request, response) => {
    const id = parseId(request.params.id);
    if (!store.remove(id)) return response.status(404).json({ error: 'Artifact not found' });
    broadcaster({ type: 'artifact.deleted', id });
    return response.status(204).end();
  });

  app.use((error, _request, response, _next) => {
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
      return response.status(400).json({ error: 'Request body must contain valid JSON' });
    }
    console.error(error);
    return response.status(500).json({ error: 'Internal server error' });
  });
  return app;
}

async function refreshAll(artifacts, store, broadcaster) {
  const total = artifacts.length;
  let completed = 0;
  broadcaster({ type: 'refresh.started', total, completed, artifactIds: artifacts.map((artifact) => artifact.id) });

  for (const artifact of artifacts) {
    try {
      const resolved = await resolveArtifactVersions(artifact);
      const updated = store.updateComputed(artifact.id, resolved.result);
      completed += 1;
      broadcaster({ type: 'artifact.updated', artifact: updated, error: resolved.error, refresh: {
        completed, total, artifactId: artifact.id, status: 'updated'
      } });
    } catch (error) {
      const updated = store.updateComputed(artifact.id, { currentVersion: null, latestVersion: null, latestAndGreatest: null });
      completed += 1;
      broadcaster({ type: 'artifact.updated', artifact: updated, error: error.message, refresh: {
        completed, total, artifactId: artifact.id, status: 'error'
      } });
    }
  }
  broadcaster({ type: 'refresh.completed', total, completed });
}

function parseId(value) {
  if (!/^\d+$/.test(value)) return NaN;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : NaN;
}

if (require.main === module) {
  const httpServer = http.createServer();
  const clients = new Set();
  const wss = new WebSocket.Server({ server: httpServer, path: '/websocket' });
  wss.on('connection', (socket) => {
    clients.add(socket);
    socket.on('close', () => clients.delete(socket));
  });
  const broadcaster = (message) => {
    const payload = JSON.stringify(message);
    for (const client of clients) if (client.readyState === WebSocket.OPEN) client.send(payload);
  };
  const app = createApp({ broadcaster });
  httpServer.on('request', app);
  httpServer.listen(port, () => console.log(`Version tracker running at http://127.0.0.1:${port}/`));
}

module.exports = { createApp, parseId, refreshAll };
