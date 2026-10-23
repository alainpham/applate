var globalStore = {};

// button clicks
on('click', '#quickpingbtn', function () {
    fetch('${svc-ping-path}')
        .then(function (response) { return response.text(); })
        .then(function (response) {
            console.log(response);
            showRawData('#messages', response);
        });
});

//send form (send-button or enter key)
on('submit', '#data-form', function (form, event) {
    event.preventDefault();
    fetch('${svc-send-msg-path}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formAsJson('#data-form'))
    })
        .then(function (response) { return response.json(); })
        .then(function (response) {
            console.log(response);
        });
});

// conditional formatting based on business data
function conditionalFormatting(type,key,value){

    if (type == 'person' && key == 'vote'){

        if (value == 'yes'){
            return 'positive';
        }
        else {
            return 'negative';
        }
    }

    else {
        return null;
    }
}

//conditional header
function conditionalHeaders(type){
    if (type == 'person'){
        console.log('conditional header adding edit col');
        return el('th', 'actions');
    }
    else {
        return null
    }
}

//adding actions to table
function conditionalActions(type, key, value){
    if (type == 'person' && key == 'id'){
        var button = el('button', 'Edit');
        button.className = 'edit-person';
        button.name = value;
        var cell = el('td');
        cell.append(button);
        return cell;
    }
    return null;
}

// click on conditional action
on('click', '.edit-person', function (button) {
    var obj = globalStore.people[button.name];
    console.log('action clicked ' + obj.id);
    var fields = document.getElementById('data-form').elements;
    ['id', 'name', 'firstName', 'vote', 'textArea'].forEach(function (key) {
        fields[key].value = obj[key] ?? '';
    });
});


// processing socket data
function functionelSockDataProcessing(rawData){
    if (rawData.metadata.type == 'person'){
        rawData.data.forEach(person => {
            if (globalStore.people == undefined){
                globalStore.people = {};
            }
            globalStore.people[person.id] = person;
        });
        upsertToTable('#state-table', rawData.data, rawData.metadata.type);
        appendToTable('#log-table', rawData.data, rawData.metadata.type);
        showRawData('#messages', rawData);
    }
}
