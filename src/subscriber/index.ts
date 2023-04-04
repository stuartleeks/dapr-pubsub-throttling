import bodyParser from 'body-parser';
import express from 'express';
import axios, { AxiosResponse } from "axios";
import { AxiosRequestConfig } from 'axios';

console.log("subscriber-dapr starting...");

const DAPR_HOST = process.env.DAPR_HOST || "http://localhost";
const DAPR_HTTP_PORT = process.env.DAPR_HTTP_PORT || "3501";

const PUBSUB_NAME = process.env.PUBSUB_NAME || "pubsub";
const PUBSUB_TOPIC = process.env.QUEUE_NAME || "orders";

const max_attempts = 5;

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
        console.log(`A: entered (timestamp: ${new Date().toISOString()})`);
        const order = req.body.data ? req.body.data : req.body;
        const id = order.id ?? "unknown";
        console.log(`A (${id}): `, order);

        const axiosConfig: AxiosRequestConfig = {
            headers: {
                "dapr-app-id": "throttling-processing-service"
            },
            validateStatus: () => true, // don't throw on non 2XX response
        };

        // Invoking a service
        let attempt = 1;
        while (true) {
            console.log(`A (${id}): invoking service (attempt: ${attempt})`);
            const serviceResult = await axios.post(`${DAPR_HOST}:${DAPR_HTTP_PORT}/orders`, order, axiosConfig);

            // https://docs.dapr.io/reference/api/pubsub_api/#provide-routes-for-dapr-to-deliver-topic-events
            if (serviceResult.status >= 200 && serviceResult.status < 300) {
                console.log(`A (${id}): Order passed: ` + serviceResult.config.data);
                res.sendStatus(200);
                return; // All done!
            }

            const delay = getRetryAfter(serviceResult);
            if (attempt >= max_attempts) {
                break;
            }

            console.log(`A (${id}): Service returned ${serviceResult.status}, retrying in ${delay}ms`);
            await sleep(delay);
            attempt++;
        }
        console.log(`A (${id}): TODO - Failed to process, mark for retry`);
        res.send({ status: "RETRY" });
    });


    app.listen(port, () => console.log(`Node App listening on port ${port}!`));
}

function getRetryAfter(response: AxiosResponse) {
    // Dapr rate limiting sends ratelimit-reset header
    // other implementations may send Retry-After header
    const rateLimitReset = response.headers['ratelimit-reset'];
    if (rateLimitReset) {
        return parseInt(rateLimitReset) * 1000; // seconds to milliseconds
    }
    return 2000;
}
async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


start();
