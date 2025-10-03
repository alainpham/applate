// global on load
global.listeners.uiconfig.push(
    async function(uiconfig){
        console.log('custom operation on load ' + JSON.stringify(uiconfig));
    }
)

// function is executed when socket message arrives
function functionalProcessing(jsonMsg){
    data = jsonMsg.data;
    type = jsonMsg.type;
    // do you custom functional stuff here
    switch (type) {
        case "person":
            jsonMsg.formatting = {
                vote: function (value){
                    if (value=="yes"){
                        return "positive";
                    }else{
                        return "negative";
                    }
                }
            }
            break;
        default:
          console.log("no specific functional processing for type " + type);
      }

}