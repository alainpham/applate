var globalStore = {};

// button clicks
$(document).on(
    'click', 
    '#quickpingbtn', 
    function () {
        $.get(
            '${svc-ping-path}', 
            function(response) {
                console.log(response);
                showRawData('#messages', response);
            }
        );
    }
);

//send-button
$(document).on(
    'click', 
    '#send-button', 
    function () {
        var request = JSON.stringify(formAsJson('#data-form'));
        $.ajax({
            url: '${svc-send-msg-path}',
            type: 'POST',
            data: request,
            contentType: 'application/json',
            success: function(response) {
                console.log(response);
            }
        });
    }
);

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
        return '<th>actions</th>';
    }
    else {
        return null
    }
}

//adding actions to table
function conditionalActions(type, key, value){
    if (type == 'person' && key == 'id'){
        return '<td><button class="edit-person" name="' + value + '">Edit</button></td>';
    }
}

// click on conditional action
$(document).on(
    'click', 
    ".edit-person", 
    function () {
        var personId = this.name;
        var obj = globalStore.people[personId];
        console.log('action clicked ' + obj.id);
        $("input[name='id']").val(obj.id);
        $("input[name='name']").val(obj.name);
        $("input[name='firstName']").val(obj.firstName);
        $("select[name='vote']").val(obj.vote);
        $("textarea[name='textArea']").val(obj.textArea);
    }   
);


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