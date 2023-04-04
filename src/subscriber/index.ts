import bodyParser from 'body-parser';
import express from 'express';
import axios from "axios";
import { AxiosRequestConfig } from 'axios';

console.log("subscriber-dapr starting...");

const DAPR_HOST = process.env.DAPR_HOST || "http://localhost";
const DAPR_HTTP_PORT = process.env.DAPR_HTTP_PORT || "3501";

const PUBSUB_NAME = process.env.PUBSUB_NAME || "pubsub";
const PUBSUB_TOPIC = process.env.QUEUE_NAME || "orders";


async function start() {
    const app: express.Application = express();
    // Dapr publishes messages with the application/cloudevents+json content-type
    app.use(bodyParser.json({ type: 'application/*+json' }));

    const port = 3000;

    app.get('/dapr/subscribe', (_req, res) => {
        console.log(`/dapr/subscribe called: pubsub_name: ${PUBSUB_NAME}, topic: ${PUBSUB_TOPIC}`)
        res.json([
            {
                pubsubname: PUBSUB_NAME,
                topic: PUBSUB_TOPIC,
                route: "A"
            }
        ]);
    });

    app.post('/A', async (req, res) => {
        console.log("A: entered");
        const order = req.body.data ? req.body.data : req.body;
        console.log("A: ", order);

        const axiosConfig : AxiosRequestConfig = {
            headers: {
                "dapr-app-id": "throttling-processing-service"
            },
            validateStatus : () => true, // don't throw on non 2XX response
          };

        // Invoking a service
        console.log("A: invoking service");
        const serviceResult = await axios.post(`${DAPR_HOST}:${DAPR_HTTP_PORT}/orders`, order, axiosConfig);
        if (serviceResult.status >= 200 && serviceResult.status < 300) {
            console.log("A: Order passed: " + serviceResult.config.data);
            res.sendStatus(200);
        } else if (serviceResult.status == 429) {
            console.log("TODO - retry");
            res.sendStatus(429);
        } else {
            console.log("TODO - Failed to process, don't complete message?!");
            res.sendStatus(400);
        }
    });


    app.listen(port, () => console.log(`Node App listening on port ${port}!`));
}

start();
