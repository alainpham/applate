var trackerState = null;
var requestPending = false;
var statusLabels = {
    'unchecked': 'Not checked', 'update-available': 'Update available',
    'up-to-date': 'Up to date', 'ahead': 'Ahead of index',
    'no-matching-version': 'No matching release', 'error': 'Error'
};

function statusColor(status) {
    if (['update-available', 'error', 'no-matching-version'].includes(status)) return 'negative';
    if (['up-to-date', 'ahead'].includes(status)) return 'positive';
    return '';
}

async function requestJson(url, options) {
    var response = await fetch(url, options);
    var body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Request failed: ' + response.status);
    return body;
}

function displayError(error) {
    var message = document.getElementById('check-error');
    message.textContent = error ? error.message : '';
    message.classList.toggle('hidden', !error);
}

function updateTracker(data) {
    trackerState = data;
    var projectFilter = document.getElementById('project-filter');
    var selected = projectFilter.value;
    projectFilter.replaceChildren();
    var all = el('option', 'All projects');
    all.value = '';
    projectFilter.append(all);
    Array.from(new Set(data.dependencies.map(function (item) { return item.project; }))).sort().forEach(function (project) {
        var option = el('option', project);
        option.value = project;
        projectFilter.append(option);
    });
    projectFilter.value = selected;
    if (projectFilter.selectedIndex === -1) projectFilter.value = '';
    document.getElementById('total-count').textContent = data.summary.total;
    document.getElementById('update-count').textContent = data.summary.updates;
    document.getElementById('update-count').classList.toggle('negative', data.summary.updates > 0);
    document.getElementById('current-count').textContent = data.summary.current;
    document.getElementById('error-count').textContent = data.summary.errors;
    var button = document.getElementById('check-button');
    button.disabled = data.checking || requestPending;
    button.textContent = data.checking ? 'Checking…' : 'Check for updates';
    document.getElementById('check-status').textContent = data.checking
        ? 'Checking dependencies: ' + (data.summary.total - data.summary.unchecked) + ' / ' + data.summary.total
        : data.checkedAt ? 'Last checked ' + new Date(data.checkedAt).toLocaleString()
        : 'Ready to check. Current versions come from the configured project files.';
    renderDependencies();
}

function renderDependencies() {
    if (!trackerState) return;
    var project = document.getElementById('project-filter').value;
    var status = document.getElementById('status-filter').value;
    var search = document.getElementById('search-filter').value.toLowerCase().trim();
    var rows = trackerState.dependencies.filter(function (item) {
        return (!project || item.project === project) && (!status || item.status === status)
            && (!search || (item.project + ' ' + item.coordinates).toLowerCase().includes(search));
    });
    var body = document.querySelector('#dependencies-table tbody');
    body.replaceChildren();
    rows.forEach(function (item) {
        var row = el('tr');
        var projectCell = el('td');
        projectCell.append(el('div', item.project));
        var source = el('small', item.currentVersionResource);
        source.title = item.currentVersionExpression;
        projectCell.append(el('br'), source);
        var dependency = el('td');
        dependency.append(el('code', item.coordinates));
        if (item.latestVersionFilter) dependency.append(el('br'), el('small', 'Filter: ' + item.latestVersionFilter));
        var matching = el('td', item.latestVersion || '—');
        matching.className = statusColor(item.matchingStatus);
        matching.title = statusLabels[item.matchingStatus] || '';
        var greatest = el('td', item.latestAndGreatestVersion || '—');
        greatest.className = statusColor(item.status);
        greatest.title = item.error || statusLabels[item.status] || '';
        row.append(projectCell, dependency, el('td', item.currentVersion || '—'), matching, greatest);
        body.append(row);
    });
    document.getElementById('empty-state').classList.toggle('hidden', rows.length !== 0);
}

on('click', '#check-button', async function () {
    requestPending = true;
    document.getElementById('check-button').disabled = true;
    document.getElementById('check-status').textContent = 'Starting version check…';
    displayError(null);
    try { updateTracker(await requestJson('/api/check', {method: 'POST'})); }
    catch (error) { displayError(error); }
    finally {
        requestPending = false;
        if (trackerState) updateTracker(trackerState);
    }
});

on('change', '#project-filter, #status-filter', renderDependencies);
on('input', '#search-filter', renderDependencies);
on('click', '#quickpingbtn', function () { requestJson('/ping').catch(displayError); });

function functionelSockDataProcessing(message) {
    if (message.metadata.type === 'dependencies') updateTracker(message.data);
}

requestJson('/api/dependencies').then(updateTracker).catch(displayError);
