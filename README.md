# entrance-lights

Runs on the main Pi as the Portainer stack "entrancelights" (container `entrance-lights`).

- **The porch light:** after dark (the hours by month in `App/app.js`), the front door opening
  or movement outside switches it on over MQTT (`esp/front/door/light`), and it goes off 2
  minutes after the last of them.
- **Someone at the front door**, for the kitchen iPad's home screen: `GET /entrance` on port
  **8772** (the screens' nginx passes it on as `/entrance`) answers
  `{someone, visit, visitSeconds, motion, doorOpen}`. A visit starts when the outdoor motion
  sensor goes from quiet to someone there and ends when it goes quiet again or the front door
  opens. Movement in the 2 minutes after the door opens is one of us going in or out, and
  starts nothing.

The sensors are Zigbee2MQTT topics from the stack's environment: `DOOR_SENSOR_TOPIC` and
`OUTDOOR_SENSOR_TOPIC`. A second outdoor sensor (`0xa4c1383eda8e611e`) is still listened to
but hasn't been on the Zigbee network since before February 2025.

## Build

Only the code changes, so build it on top of the last full build:

```
docker buildx build --builder multi -f Dockerfile.code -t migruiz/entrance-lights --load .
```
