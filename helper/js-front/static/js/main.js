//initiating the page
$(document).ready(
    function () {

        //loading the navbar
        $('#navbar').load('partials/navbar.html');
        console.log('navbar loaded');

        // loading theme content
        $.get('/uiconfig', function (data) {
            var link = $('<link>', {
                rel: 'stylesheet',
                type: 'text/css',
                href: 'css/' + data.theme + '.css'
            });
            $('head').append(link);
        });

        //web socket connection
        connectSocket()
    }
);

// click on hamburger show menu
$(document).on(
    'click', 
    '#menubtn', 
    function () {
        $('#nav').toggleClass('responsive');
    }
);

// connecting to the websocket
function connectSocket() {
    // receiving functions 
    var server = ((window.location.protocol === 'https:') ? 'wss://' : 'ws://') + window.location.hostname + ":" + window.location.port + "/websocket";
    var socket = new WebSocket(server);
    socket.onmessage = processSocketMsg;

    socket.onopen = function () {
        console.log("socket connection ok")
        var $logo = $('#logo');
        if ($logo.length) {
            $logo.removeClass('negative');
            $('#status').addClass('hidden');
        }
    }
    socket.onclose = function (e) {
        console.log('Socket is closed. Reconnect will be attempted in 2 second.', e.reason);
        var $logo = $('#logo');
        if ($logo.length) {
            $logo.addClass('negative');
            $('#status').removeClass('hidden');
        }
        setTimeout(function () {
            connectSocket();
        }, 3000);
    };

    socket.onerror = function (err) {
        console.error('Socket encountered error: ', err.message, 'Closing socket');
        socket.close();
    };
}

// processing socket messages
function processSocketMsg(event) {
    var rawdata = JSON.parse(event.data);
    console.log("comming from websocket server: ", rawdata);
    functionelSockDataProcessing(rawdata);
}


function formAsJson(formid) {
    var data = {};
    $.each(
        $(formid).serializeArray(), 
        function () {
            data[this.name] = this.value;
        }
    );
    return data;
}


//table manupulation

function populateTableHeader(tableId, dataTable,type) {
    var table = $(tableId);
    if (table.find('thead').length === 0) {
        var headers = Object.keys(dataTable[0]);
        var thead = $('<thead></thead>');
        var tr = $('<tr></tr>');
        headers.forEach(
            function (header) {
                tr.append($('<th></th>').text(header));
            }
        );
        var additionalHeaders = conditionalHeaders(type);
        console.log('additional headers: ' + additionalHeaders);
        tr.append(additionalHeaders);
        thead.append(tr);
        table.append(thead);
    }
}

function populateTableBody(tableId, dataTable) {
    var table = $(tableId);
    var tbody = table.find('tbody');
    //if there is no tbody create one
    if (tbody.length === 0) {
        tbody = $('<tbody></tbody>');
        table.append(tbody);
    }
    return tbody;
}

function appendToTable(tableId, dataTable,type) {
    populateTableHeader(tableId, dataTable,type);
    var tbody = populateTableBody(tableId, dataTable);
    //for eah element in the data table
    dataTable.forEach(
        //create a row
        function (data) {
            var row = $('<tr></tr>');
            row.attr('name', data.id);
            tbody.append(row);
            populateCells(tbody,row, data, type);
    });
}


function upsertToTable(tableId, dataTable,type) {
    
    populateTableHeader(tableId, dataTable,type);
    var tbody = populateTableBody(tableId, dataTable);

    //for each element in the data table
    dataTable.forEach(
        //create a row
        function (data) {
            //look if row exists
            var row = tbody.find('tr[name="' + data.id + '"]');
            if (row.length === 0) { //row does not
                var row = $('<tr></tr>');
                row.attr('name', data.id);
                tbody.append(row);
            }
            else { //row exists
                console.log('row exists');
                row.empty();
            }
            populateCells(tbody,row, data, type);
        }
    );
}

function populateCells(tbody,row, data, type) {
    //for each key in the data row create a cell
    var additionalCells = [];
    Object.keys(data).forEach(
        function (key) {
            var cell = $('<td></td>').text(data[key]);
            row.append(cell);
            
            //conditional formatting
            var conditionalClass = conditionalFormatting(type, key, data[key]);
            if (conditionalClass != null) {
                cell.addClass(conditionalClass);
            }

            //conditional actions
            var action = conditionalActions(type, key, data[key]);
            if (action != null) {
                additionalCells.push(action);
            }

        }
    );
    for (var i = 0; i < additionalCells.length; i++) {
        row.append(additionalCells[i]);
    }
    flashAnimate(row);
}

function showRawData(element,data){
    const currentDate = new Date();
    var msg = currentDate + '\n\n' + JSON.stringify(data,null,2);
    var el=$(element);
    el.empty();
    el.text(msg);
    flashAnimate(el);
}

function flashAnimate(jqueryElement){
    jqueryElement.removeClass("flash-animation");
    void jqueryElement[0].offsetWidth;
    jqueryElement.addClass("flash-animation");
}