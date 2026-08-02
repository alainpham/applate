const editableFields = [
  'project',
  'currentVersionResource',
  'currentVersionExpression',
  'coordinates',
  'latestVersionFilter'
];

let artifacts = [];

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('artifact-form').addEventListener('submit', saveArtifact);
  document.getElementById('cancel-edit').addEventListener('click', resetForm);
  document.getElementById('refresh-button').addEventListener('click', loadArtifacts);
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
    for (const field of ['project', 'coordinates', 'currentVersion', 'latestVersion', 'latestAndGreatest']) {
      const cell = document.createElement('td');
      cell.textContent = artifact[field] || '—';
      row.appendChild(cell);
    }
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
