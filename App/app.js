const { Observable,merge,timer } = require('rxjs');
const { mergeMap, map,share,filter,mapTo,take,debounceTime,throttle,throttleTime} = require('rxjs/operators');
var mqtt = require('./mqttCluster.js');

global.mtqqLocalPath = process.env.MQTTLOCAL;
//global.mtqqLocalPath = 'mqtt://piscos.tk';


const KEEPLIGHTONFORSECS = 62 * 1000
//const STARTINGFROMHOURS = 7
//const ENDINGATHOURS = 16
const STARTINGFROMHOURS = process.env.STARTINGFROMHOURS
const ENDINGATHOURS = process.env.ENDINGATHOURS

const DOOR_SENSOR_TOPIC = process.env.DOOR_SENSOR_TOPIC
//const DOOR_SENSOR_TOPIC = 'rflink/EV1527-001c4e'

const OUTDOOR_SENSOR_TOPIC = process.env.OUTDOOR_SENSOR_TOPIC
//const OUTDOOR_SENSOR_TOPIC = 'rflink/EV1527-0a3789'


console.log(`starting entrance lights current time ${new Date()}`)

const doorEntranceSensor = new Observable(async subscriber => {  
    var mqttCluster=await mqtt.getClusterAsync()   
    mqttCluster.subscribeData(DOOR_SENSOR_TOPIC, function(content){     
        if (!content.contact)   {
            subscriber.next({content})
        }
    });
});

const outdoorSensor = new Observable(async subscriber => {  
    var mqttCluster=await mqtt.getClusterAsync()   
    mqttCluster.subscribeData(OUTDOOR_SENSOR_TOPIC, function(content){        
        if (content.occupancy){      
            subscriber.next({content})
        }
    });
});

const movementSensorsReadingStream = merge(doorEntranceSensor,outdoorSensor)



const sharedSensorStream = movementSensorsReadingStream.pipe(
    filter(_ => new Date().getHours() < STARTINGFROMHOURS || new Date().getHours() >= ENDINGATHOURS),
    share()
    )
const turnOffStream = sharedSensorStream.pipe(
    debounceTime(KEEPLIGHTONFORSECS),
    mapTo("off"),
    share()
    )

const turnOnStream = sharedSensorStream.pipe(
    throttle(_ => turnOffStream),
    mapTo("on")
)

merge(turnOnStream,turnOffStream)
.subscribe(async m => {
    console.log(m);
    (await mqtt.getClusterAsync()).publishMessage('esp/front/door/light',m)
})


