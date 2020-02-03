const { Observable,of,merge,empty,interval } = require('rxjs');
const { groupBy,mergeMap,throttleTime,map,share,filter,first,mapTo,timeoutWith,timeout,shareReplay,ignoreElements,debounceTime, toArray,takeWhile,delay,tap,distinct,bufferWhen} = require('rxjs/operators');
var mqtt = require('./mqttCluster.js');

global.mtqqLocalPath = 'mqtt://piscos.tk'


const movementSensorsReadingStream = new Observable(async subscriber => {  
    var mqttCluster=await mqtt.getClusterAsync()   
    mqttCluster.subscribeData('Eurodomest', function(content){
        if (content.ID==='206aae' || content.ID==='006aae'){
            subscriber.next({data:'16340250'})
        }
    });
});

movementSensorsReadingStream.subscribe(q => console.log(JSON.stringify(q)))


