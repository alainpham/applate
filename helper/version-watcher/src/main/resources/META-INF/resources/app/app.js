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
        case "artifact":
            delete jsonMsg.data[0].currentVersionExpression;
            delete jsonMsg.data[0].currentVersionResource;
            jsonMsg.data[0].minorMatch = jsonMsg.data[0].currentVersion == jsonMsg.data[0].latestVersion ? "yes" : "no"
            jsonMsg.data[0].majorMatch = jsonMsg.data[0].currentVersion == jsonMsg.data[0].latestAndGreatest ? "yes" : "no"

            jsonMsg.formatting = {
                minorMatch: function (value){
                    if (value == "yes"){
                        return "positive";
                    }else{
                        return "negative";
                    }
                },
                majorMatch: function (value){
                    if (value == "yes"){
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