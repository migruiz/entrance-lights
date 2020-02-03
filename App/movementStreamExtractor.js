const { Observable,of,merge,empty,interval } = require('rxjs');
const { groupBy,mergeMap,throttleTime,startWith, map,share,filter,first,mapTo,timeoutWith,timeout,shareReplay,ignoreElements,debounceTime,throttle, toArray,takeWhile,delay,tap,distinct,bufferWhen} = require('rxjs/operators');
var mqtt = require('./mqttCluster.js');

global.mtqqLocalPath = 'mqtt://piscos.tk'

const KEEPLIGHTONFORSECS = 30 * 1000
const STARTINGFROMHOURS = 14
const ENDINGATHOURS = 20



const movementSensorsReadingStream = new Observable(async subscriber => {  
    var mqttCluster=await mqtt.getClusterAsync()   
    mqttCluster.subscribeData('Eurodomest', function(content){
        if (content.ID==='12345'){
            subscriber.next({data:'16340250'})
        }
    });
});

const sharedSensorStream = movementSensorsReadingStream.pipe(
    filter(_ => new Date().getHours() >= STARTINGFROMHOURS && new Date().getHours() < ENDINGATHOURS),
    share()
    )
const turnOffStream = sharedSensorStream.pipe(
    debounceTime(KEEPLIGHTONFORSECS),
    mapTo("OFF"),
    share()
    )

const turnOnStream = sharedSensorStream.pipe(
    throttle(_ => turnOffStream),
    mapTo("ON")
)

merge(turnOnStream,turnOffStream).subscribe(q => console.log(JSON.stringify(q)))


