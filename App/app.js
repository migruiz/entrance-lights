const { Observable,merge,timer } = require('rxjs');
const { mergeMap, map,share,filter,mapTo,take,debounceTime,throttle,throttleTime} = require('rxjs/operators');
var mqtt = require('./mqttCluster.js');

global.mtqqLocalPath = process.env.MQTTLOCAL;
//global.mtqqLocalPath = 'mqtt://piscos.tk';


const KEEPLIGHTONFORSECS = 30 * 1000
//const STARTINGFROMHOURS = 8
//const ENDINGATHOURS = 17
const STARTINGFROMHOURS = process.env.STARTINGFROMHOURS
const ENDINGATHOURS = process.env.ENDINGATHOURS

const LIGHTONPAYLOAD = {payload: "10;TriState;8029a0;10;ON;"}
const LIGHTOFFPAYLOAD = {payload: "10;TriState;8029a0;10;OFF;"}


console.log(`starting entrance lights current time ${new Date()}`)
const movementSensorsReadingStream = new Observable(async subscriber => {  
    var mqttCluster=await mqtt.getClusterAsync()   
    mqttCluster.subscribeData('EV1527', function(content){
        if (content.ID==='00391d' || content.ID==='0ce052'){
            console.log(content.ID);
            subscriber.next({data:'16340250'})
        }
    });
});

const sharedSensorStream = movementSensorsReadingStream.pipe(
    filter(_ => new Date().getHours() < STARTINGFROMHOURS || new Date().getHours() >= ENDINGATHOURS),
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

merge(turnOnStream,turnOffStream).
pipe(
    map(e => e==="ON" ? LIGHTONPAYLOAD : LIGHTOFFPAYLOAD),  
    mergeMap(e => timer(200,1000).pipe(take(5),mapTo(e)))
)
.subscribe(async m => {
    console.log(JSON.stringify(m));
    (await mqtt.getClusterAsync()).publishData('rflinkTX',m)
})


