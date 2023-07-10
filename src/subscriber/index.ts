import bodyParser from 'body-parser';
import express from 'express';
import axios, { AxiosResponse } from "axios";
import { AxiosRequestConfig } from 'axios';
import TokenBucket from "tokenbucket";

console.log("subscriber-dapr starting...");

const DAPR_HOST = process.env.DAPR_HOST || "http://localhost";
const DAPR_HTTP_PORT = process.env.DAPR_HTTP_PORT || "3501";

const PUBSUB_NAME = process.env.PUBSUB_NAME || "pubsub";
const PUBSUB_TOPIC = process.env.QUEUE_NAME || "orders";

const HANDLER_TYPE = process.env.HANDLER_TYPE?.toUpperCase() || "SIMPLE"; // SIMPLE or TOKEN_BUCKET

const max_attempts = 3; // Tune this - could also add exponential back-off etc

// NOTE: this was the initial library I found - worth researching other options!
const tokenbucket = new TokenBucket({
    size: 1, // single token, i.e. 1 RPS
    interval: 1000, // refill every 1100ms (just over the 1s rate limit for processing-service)
    maxWait: 1000 * 60 * 3, // max wait time of 3 minutes to obtain a token
    spread: true
});

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
                route: "/handle-message"
            }
        ]);
    });

    // Use this mapping to handle retries, but not apply any limiting from this service
    // app.post('/A', handleWithRetry);

    // Use this mapping to handle retries and limit the service invocations from this service
    // through the token bucket
    if (HANDLER_TYPE === "TOKEN_BUCKET") {
        console.log("Using token bucket handler");
        app.post('/handle-message', handleWithRetryAndTokenBucket);
    } else {
        console.log("Using simple handler");
        app.post('/handle-message', handleWithRetry);
    }

    app.listen(port, () => console.log(`Node App listening on port ${port}!`));
}

// handle message using retry on 429 responses from processing service
async function handleWithRetry(req: express.Request, res: express.Response) {
    console.log(`handleWithRetry: entered (timestamp: ${new Date().toISOString()})`);
    const order = req.body.data ? req.body.data : req.body;
    const id = order.id ?? "unknown";
    console.log(`handleWithRetry (${id}): `, order);

    const axiosConfig: AxiosRequestConfig = {
        headers: {
            "dapr-app-id": "throttling-processing-service"
        },
        validateStatus: () => true, // don't throw on non 2XX response
    };

    // Invoking a service
    let attempt = 1;
    while (true) {
        console.log(`handleWithRetry (${id}): invoking service (attempt: ${attempt})`);
        const serviceResult = await axios.post(`${DAPR_HOST}:${DAPR_HTTP_PORT}/orders`, order, axiosConfig);

        // https://docs.dapr.io/reference/api/pubsub_api/#provide-routes-for-dapr-to-deliver-topic-events
        if (serviceResult.status >= 200 && serviceResult.status < 300) {
            console.log(`handleWithRetry (${id}): Order passed: ` + serviceResult.config.data);
            res.sendStatus(200);
            return; // All done!
        }

        if (attempt >= max_attempts) {
            break;
        }
        const delay = getRetryAfter(serviceResult);
        console.log(`handleWithRetry (${id}): Service returned ${serviceResult.status}, retrying in ${delay}ms`);
        await sleep(delay);
        attempt++;
    }
    console.log(`handleWithRetry (${id}): TODO - Failed to process, mark for retry`);
    res.send({ status: "RETRY" });
}


// handle message using retry on 429 responses from processing service
// and apply token bucket rate limiting
async function handleWithRetryAndTokenBucket(req: express.Request, res: express.Response) {
    console.log(`handleWithRetryAndTokenBucket: entered (timestamp: ${new Date().toISOString()})`);
    const order = req.body.data ? req.body.data : req.body;
    const id = order.id ?? "unknown";
    console.log(`handleWithRetryAndTokenBucket (${id}): `, order);

    const axiosConfig: AxiosRequestConfig = {
        headers: {
            "dapr-app-id": "throttling-processing-service"
        },
        validateStatus: () => true, // don't throw on non 2XX response
    };

    // Invoking a service
    let attempt = 1;
    while (true) {
        console.log(`handleWithRetryAndTokenBucket (${id}, attempt: ${attempt}, timestamp: ${new Date().toISOString()}): get token`);
        await tokenbucket.removeTokens(1); // TODO - handle errors

        console.log(`handleWithRetryAndTokenBucket (${id}, attempt: ${attempt}, timestamp: ${new Date().toISOString()}): invoking service`);
        const serviceResult = await axios.post(`${DAPR_HOST}:${DAPR_HTTP_PORT}/orders`, order, axiosConfig);

        // https://docs.dapr.io/reference/api/pubsub_api/#provide-routes-for-dapr-to-deliver-topic-events
        if (serviceResult.status >= 200 && serviceResult.status < 300) {
            console.log(`handleWithRetryAndTokenBucket (${id}): Order passed: ` + serviceResult.config.data);
            res.sendStatus(200);
            return; // All done!
        }

        if (attempt >= max_attempts) {
            break;
        }
        const delay = getRetryAfter(serviceResult);
        console.log(`handleWithRetryAndTokenBucket (${id}): Service returned ${serviceResult.status}, retrying in ${delay}ms`);
        await sleep(delay);
        attempt++;
    }
    console.log(`handleWithRetryAndTokenBucket (${id}): TODO - Failed to process, mark for retry`);
    res.send({ status: "RETRY" });
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
