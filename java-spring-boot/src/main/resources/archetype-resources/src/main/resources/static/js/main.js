//initiating the page (scripts are loaded at the end of body, the DOM is ready)

// loading theme content
fetch('/uiconfig')
    .then(function (response) { return response.json(); })
    .then(function (data) {
        document.documentElement.dataset.theme = data.theme;
        try { localStorage.setItem('theme', data.theme); } catch (e) {}
    });

//loading the navbar, then the web socket connection that updates its status
fetch('partials/navbar.html')
    .then(function (response) { return response.text(); })
    .then(function (html) {
        document.getElementById('navbar').innerHTML = html;
        console.log('navbar loaded');
    })
    .finally(connectSocket);

// delegated event handler, works for elements added after page load
// handler receives the matched element and the event
function on(eventType, selector, handler) {
    document.addEventListener(eventType, function (event) {
        var element = event.target.closest(selector);
        if (element) {
            handler(element, event);
        }
    });
}

// click on hamburger show menu
on('click', '#menubtn', function () {
    document.getElementById('nav').classList.toggle('responsive');
});

// connecting to the websocket
function connectSocket() {
    // receiving functions
    var server = ((window.location.protocol === 'https:') ? 'wss://' : 'ws://') + window.location.host + "/websocket";
    var socket = new WebSocket(server);
    socket.onmessage = processSocketMsg;

    socket.onopen = function () {
        console.log("socket connection ok")
        setServerStatus(true);
    }
    socket.onclose = function (e) {
        console.log('Socket is closed. Reconnect will be attempted in 3 seconds.', e.reason);
        setServerStatus(false);
        setTimeout(connectSocket, 3000);
    };

    socket.onerror = function (err) {
        console.error('Socket encountered error: ', err.message, 'Closing socket');
        socket.close();
    };
}

function setServerStatus(online) {
    var logo = document.getElementById('logo');
    if (logo) {
        logo.classList.toggle('negative', !online);
        document.getElementById('status').classList.toggle('hidden', online);
    }
}

// processing socket messages
function processSocketMsg(event) {
    var rawdata = JSON.parse(event.data);
    console.log("comming from websocket server: ", rawdata);
    functionelSockDataProcessing(rawdata);
}


function formAsJson(formid) {
    return Object.fromEntries(new FormData(document.querySelector(formid)));
}

// create an element with optional text content
function el(tag, text) {
    var element = document.createElement(tag);
    if (text !== undefined) {
        element.textContent = text;
    }
    return element;
}


//table manupulation

function populateTableHeader(tableId, dataTable,type) {
    var table = document.querySelector(tableId);
    if (!table.tHead && dataTable.length > 0) {
        var headers = Object.keys(dataTable[0]);
        var tr = table.createTHead().insertRow();
        headers.forEach(
            function (header) {
                tr.append(el('th', header));
            }
        );
        var additionalHeaders = conditionalHeaders(type);
        if (additionalHeaders != null) {
            console.log('additional headers: ', additionalHeaders);
            tr.append(additionalHeaders);
        }
    }
}

function populateTableBody(tableId) {
    var table = document.querySelector(tableId);
    //if there is no tbody create one
    return table.tBodies[0] || table.createTBody();
}

function appendToTable(tableId, dataTable,type) {
    populateTableHeader(tableId, dataTable,type);
    var tbody = populateTableBody(tableId);
    //for eah element in the data table
    dataTable.forEach(
        //create a row
        function (data) {
            var row = tbody.insertRow();
            row.setAttribute('name', data.id);
            populateCells(row, data, type);
    });
}


function upsertToTable(tableId, dataTable,type) {

    populateTableHeader(tableId, dataTable,type);
    var tbody = populateTableBody(tableId);

    //for each element in the data table
    dataTable.forEach(
        //create a row
        function (data) {
            //look if row exists
            var row = tbody.querySelector('tr[name="' + CSS.escape(String(data.id)) + '"]');
            if (row == null) { //row does not
                row = tbody.insertRow();
                row.setAttribute('name', data.id);
            }
            else { //row exists
                console.log('row exists');
                row.replaceChildren();
            }
            populateCells(row, data, type);
        }
    );
}

function populateCells(row, data, type) {
    //for each key in the data row create a cell
    var additionalCells = [];
    Object.keys(data).forEach(
        function (key) {
            var cell = el('td', data[key]);
            row.append(cell);

            //conditional formatting
            var conditionalClass = conditionalFormatting(type, key, data[key]);
            if (conditionalClass != null) {
                cell.classList.add(conditionalClass);
            }

            //conditional actions
            var action = conditionalActions(type, key, data[key]);
            if (action != null) {
                additionalCells.push(action);
            }

        }
    );
    row.append.apply(row, additionalCells);
    flashAnimate(row);
}

function showRawData(selector,data){
    const currentDate = new Date();
    var element = document.querySelector(selector);
    element.textContent = currentDate + '\n\n' + JSON.stringify(data,null,2);
    flashAnimate(element);
}

function flashAnimate(element){
    element.classList.remove("flash-animation");
    void element.offsetWidth;
    element.classList.add("flash-animation");
}
