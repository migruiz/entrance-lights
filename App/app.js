const { Observable,merge,timer } = require('rxjs');
const { mergeMap, map,share,filter,mapTo,take,debounceTime,throttle,throttleTime} = require('rxjs/operators');
var mqtt = require('./mqttCluster.js');
const {DateTime} = require('luxon');





const sunRiseSetHourByMonth = {
    1:{
        sunRise: 9,
        sunSet: 16
    },
    2:{
        sunRise: 9,
        sunSet: 17
    },
    3:{
        sunRise: 8,
        sunSet: 18
    },
    4:{
        sunRise: 7,
        sunSet: 19
    },
    5:{
        sunRise: 6,
        sunSet: 20
    },
    6:{
        sunRise: 6,
        sunSet: 21
    },
    7:{
        sunRise: 6,
        sunSet: 21
    },
    8:{
        sunRise: 6,
        sunSet: 20
    },
    9:{
        sunRise: 6,
        sunSet: 19
    },
    10:{
        sunRise: 7,
        sunSet: 18
    },
    11:{
        sunRise: 8,
        sunSet: 17
    },
    12:{
        sunRise: 9,
        sunSet: 16
    },
}

global.mtqqLocalPath = process.env.MQTTLOCAL;
//global.mtqqLocalPath = 'mqtt://piscos.tk';


const KEEPLIGHTONFORSECS = 120 * 1000

const DOOR_SENSOR_TOPIC = process.env.DOOR_SENSOR_TOPIC
//const DOOR_SENSOR_TOPIC = 'rflink/EV1527-001c4e'

const OUTDOOR_SENSOR_TOPIC = process.env.OUTDOOR_SENSOR_TOPIC
//const OUTDOOR_SENSOR_TOPIC = 'rflink/EV1527-0a3789'




console.log(`starting entrance lights current time ${DateTime.now()}`)

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
            console.log(`motion detected`);
            subscriber.next({content})
        }
    });
});

const secondOutdoorSensor = new Observable(async subscriber => {  
    var mqttCluster=await mqtt.getClusterAsync()   
    mqttCluster.subscribeData('zigbee2mqtt/0xa4c1383eda8e611e', function(content){        
        if (content.occupancy){      
            console.log(`motion detected 2nd`);
            subscriber.next({content})
        }
    });
});



const movementSensorsReadingStream = merge(doorEntranceSensor,outdoorSensor, secondOutdoorSensor)



const sharedSensorStream = movementSensorsReadingStream.pipe(
    filter(_ => 
        DateTime.now().hour < sunRiseSetHourByMonth[DateTime.now().month].sunRise || 
        DateTime.now().hour >= sunRiseSetHourByMonth[DateTime.now().month].sunSet),
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


// --- Someone at the front door, for the kitchen iPad's home screen -----------------------
// The screens' nginx passes GET /entrance on to this port. The home screen asks every 2
// seconds, and while `someone` is true it flashes Front door and shows the camera.
const http = require('http');
const SCREEN_PORT = 8772;
// Movement this soon after the front door opens is one of us going in or out.
const IGNORE_AFTER_DOOR = 2 * 60 * 1000;

const entrance = {
    motion: false,      // what the outdoor sensor last said
    doorOpen: null,     // null until the door sensor has reported
    doorOpenedAt: 0,
    visitSince: 0,      // when the visitor outside showed up; 0 when there is nobody
};

mqtt.getClusterAsync().then(mqttCluster => {
    // A visit starts when the sensor goes from quiet to someone there, and ends when it goes
    // quiet again (Zigbee2MQTT says so 90 seconds after the last movement).
    mqttCluster.subscribeData(OUTDOOR_SENSOR_TOPIC, function(content){
        if (typeof content.occupancy !== 'boolean' || content.occupancy === entrance.motion) return;
        entrance.motion = content.occupancy;
        if (!entrance.motion) {
            if (entrance.visitSince) console.log(`${DateTime.now()} nobody outside any more`);
            entrance.visitSince = 0;
        } else if (Date.now() - entrance.doorOpenedAt < IGNORE_AFTER_DOOR) {
            console.log(`${DateTime.now()} movement outside just after the door opened: one of us`);
        } else {
            entrance.visitSince = Date.now();
            console.log(`${DateTime.now()} someone outside`);
        }
    });
    // The door opening ends a visit: someone answered, or came in.
    mqttCluster.subscribeData(DOOR_SENSOR_TOPIC, function(content){
        if (typeof content.contact !== 'boolean') return;
        const open = !content.contact;
        if (open && entrance.doorOpen !== true) {
            entrance.doorOpenedAt = Date.now();
            if (entrance.visitSince) console.log(`${DateTime.now()} door opened, the visit is over`);
            entrance.visitSince = 0;
        }
        entrance.doorOpen = open;
    });
});

http.createServer((request, response) => {
    if (request.method !== 'GET' || request.url !== '/entrance') {
        response.writeHead(404);
        response.end();
        return;
    }
    const now = Date.now();
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({
        someone: entrance.visitSince > 0,
        // Tells one visit from the next; only its seconds are meant for the screen, since the
        // iPad's clock and this one may differ.
        visit: entrance.visitSince || null,
        visitSeconds: entrance.visitSince ? Math.round((now - entrance.visitSince) / 1000) : null,
        motion: entrance.motion,
        doorOpen: entrance.doorOpen,
    }));
}).listen(SCREEN_PORT, () => console.log(`screen port ${SCREEN_PORT}`));
