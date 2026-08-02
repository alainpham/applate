const editableFields = [
  'project',
  'currentVersionResource',
  'currentVersionExpression',
  'coordinates',
  'latestVersionFilter'
];

let artifacts = [];
let refreshActive = false;
const refreshStatuses = new Map();

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('artifact-form').addEventListener('submit', saveArtifact);
  document.getElementById('cancel-edit').addEventListener('click', resetForm);
  document.getElementById('refresh-button').addEventListener('click', refreshArtifacts);
  connectSocket();
  loadArtifacts();
});

async function request(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try { message = (await response.json()).error || message; } catch (_) { /* no JSON error */ }
    throw new Error(message);
  }
  return response.status === 204 ? null : response.json();
}

async function loadArtifacts() {
  setTableMessage('Loading artifacts…');
  try {
    artifacts = await request('/api/artifacts');
    renderArtifacts();
  } catch (error) {
    setTableMessage(error.message, true);
  }
}

async function refreshArtifacts() {
  const button = document.getElementById('refresh-button');
  button.disabled = true;
  refreshActive = true;
  updateRefreshProgress(0, 0, 'Starting refresh…');
  try {
    const result = await request('/api/artifacts/refresh', { method: 'POST' });
    if (result.status === 'already-running') {
      updateRefreshProgress(0, 0, 'A refresh is already running; waiting for progress…');
    }
  } catch (error) {
    refreshActive = false;
    button.disabled = false;
    hideRefreshProgress();
    setTableMessage(error.message, true);
  }
}

async function saveArtifact(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(editableFields.map((field) => [field, form.elements[field].value]));
  const id = form.elements.id.value;
  try {
    await request(id ? `/api/artifacts/${id}` : '/api/artifacts', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    resetForm();
    showFormMessage('Artifact saved.');
    await loadArtifacts();
  } catch (error) {
    showFormMessage(error.message, true);
  }
}

async function deleteArtifact(id) {
  if (!window.confirm('Delete this artifact?')) return;
  try {
    await request(`/api/artifacts/${id}`, { method: 'DELETE' });
    await loadArtifacts();
  } catch (error) {
    setTableMessage(error.message, true);
  }
}

function editArtifact(id) {
  const artifact = artifacts.find((item) => item.id === id);
  if (!artifact) return;
  const form = document.getElementById('artifact-form');
  form.elements.id.value = artifact.id;
  editableFields.forEach((field) => { form.elements[field].value = artifact[field] || ''; });
  document.getElementById('form-title').textContent = `Edit artifact #${artifact.id}`;
  document.getElementById('cancel-edit').classList.remove('hidden');
  form.elements.project.focus();
}

function resetForm() {
  const form = document.getElementById('artifact-form');
  form.reset();
  form.elements.id.value = '';
  document.getElementById('form-title').textContent = 'Add artifact';
  document.getElementById('cancel-edit').classList.add('hidden');
}

function renderArtifacts() {
  const tbody = document.querySelector('#artifact-table tbody');
  tbody.replaceChildren();
  if (!artifacts.length) {
    setTableMessage('No artifacts yet. Add one using the form.');
    return;
  }
  document.getElementById('table-message').textContent = '';
  for (const artifact of artifacts) {
    const row = document.createElement('tr');
    for (const field of ['project', 'coordinates']) {
      const cell = document.createElement('td');
      cell.textContent = artifact[field] || '—';
      row.appendChild(cell);
    }
    const sourceCell = document.createElement('td');
    const sourceUrl = versionSourceUrl(artifact.coordinates);
    if (sourceUrl) {
      const link = document.createElement('a');
      link.href = sourceUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = artifact.coordinates.toLowerCase().startsWith('mvn:') ? 'Maven metadata' : 'Docker Hub tags';
      link.title = sourceUrl;
      sourceCell.appendChild(link);
    } else {
      sourceCell.textContent = '—';
    }
    row.appendChild(sourceCell);
    for (const field of ['currentVersion', 'latestVersion', 'latestAndGreatest']) {
      const cell = document.createElement('td');
      cell.textContent = artifact[field] || '—';
      if ((field === 'latestVersion' || field === 'latestAndGreatest')
        && artifact.currentVersion && artifact[field]) {
        cell.classList.add(artifact[field] === artifact.currentVersion ? 'positive' : 'negative');
      }
      row.appendChild(cell);
    }
    const status = document.createElement('td');
    status.textContent = refreshStatuses.get(artifact.id) || '—';
    status.className = refreshStatuses.get(artifact.id) === 'error' ? 'error' : '';
    row.appendChild(status);
    const actions = document.createElement('td');
    const edit = document.createElement('button');
    edit.type = 'button'; edit.textContent = 'Edit';
    edit.addEventListener('click', () => editArtifact(artifact.id));
    const remove = document.createElement('button');
    remove.type = 'button'; remove.textContent = 'Delete'; remove.className = 'danger';
    remove.addEventListener('click', () => deleteArtifact(artifact.id));
    actions.append(edit, remove);
    row.appendChild(actions);
    tbody.appendChild(row);
  }
}

function versionSourceUrl(coordinates) {
  if (typeof coordinates !== 'string') return null;
  const parts = coordinates.split(':');
  if (parts[0].toLowerCase() === 'mvn' && parts.length === 3) {
    const groupPath = parts[1].split('.').join('/');
    return `https://repo.maven.apache.org/maven2/${groupPath}/${parts[2]}/maven-metadata.xml`;
  }
  if (parts[0].toLowerCase() === 'docker' && parts.length >= 2) {
    const repositoryPath = parts[1].replace('/', '/repositories/');
    const tagPrefix = parts.slice(2).join(':');
    return `https://hub.docker.com/v2/namespaces/${repositoryPath}/tags?page_size=100&name=${encodeURIComponent(tagPrefix)}`;
  }
  return null;
}

function connectSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${window.location.host}/websocket`);
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'refresh.started') {
      refreshActive = true;
      document.getElementById('refresh-button').disabled = true;
      (message.artifactIds || artifacts.map((artifact) => artifact.id))
        .forEach((id) => refreshStatuses.set(id, 'queued'));
      renderArtifacts();
      updateRefreshProgress(message.completed, message.total, 'Refreshing…');
      return;
    }
    if (message.type === 'refresh.completed') {
      refreshActive = false;
      document.getElementById('refresh-button').disabled = false;
      updateRefreshProgress(message.completed, message.total, 'Refresh complete');
      return;
    }
    if (!message.artifact || message.type !== 'artifact.updated') return;
    const index = artifacts.findIndex((artifact) => artifact.id === message.artifact.id);
    if (index === -1) artifacts.push(message.artifact);
    else artifacts[index] = message.artifact;
    refreshStatuses.set(message.artifact.id, message.error ? 'error' : 'updated');
    renderArtifacts();
    if (message.refresh) {
      const label = message.error
        ? `Artifact #${message.artifact.id} failed: ${message.error}`
        : `Updated ${message.artifact.project}`;
      updateRefreshProgress(message.refresh.completed, message.refresh.total, label, Boolean(message.error));
    } else if (message.error) {
      setTableMessage(`Artifact #${message.artifact.id}: ${message.error}`, true);
    }
  });
  socket.addEventListener('close', () => window.setTimeout(connectSocket, 3000));
}

function updateRefreshProgress(completed, total, label, isError = false) {
  const progress = document.getElementById('refresh-progress');
  const bar = document.getElementById('refresh-progress-bar');
  const text = document.getElementById('refresh-progress-label');
  progress.classList.remove('hidden');
  bar.max = Math.max(total, 1);
  bar.value = Math.min(completed, bar.max);
  text.textContent = total ? `${completed} / ${total} — ${label}` : label;
  text.classList.toggle('error', isError);
}

function hideRefreshProgress() {
  document.getElementById('refresh-progress').classList.add('hidden');
}

function setTableMessage(message, isError = false) {
  const element = document.getElementById('table-message');
  element.textContent = message;
  element.classList.toggle('error', isError);
}

function showFormMessage(message, isError = false) {
  const element = document.getElementById('form-message');
  element.textContent = message;
  element.classList.toggle('error', isError);
}
