import bodyParser from 'body-parser';
import express from 'express';
import axios from "axios";

console.log("subscriber-dapr starting...");

const DAPR_HOST = process.env.DAPR_HOST || "http://localhost";
const DAPR_HTTP_PORT = process.env.DAPR_HTTP_PORT || "3501";

const PUBSUB_NAME = "pubsub";
const PUBSUB_TOPIC = "orders";


async function start() {
    const app: express.Application = express();
    // Dapr publishes messages with the application/cloudevents+json content-type
    app.use(bodyParser.json({ type: 'application/*+json' }));

    const port = 3000;

    app.get('/dapr/subscribe', (_req, res) => {
        res.json([
            {
                pubsubname: PUBSUB_NAME,
                topic: PUBSUB_TOPIC,
                route: "A"
            }
        ]);
    });

    app.post('/A', async (req, res) => {
        const order = req.body.data;
        console.log("A: ", order);

        const axiosConfig = {
            headers: {
                "dapr-app-id": "processing-service"
            }
          };

        // Invoking a service
        console.log("A: invoking service");
        const serviceResult = await axios.post(`${DAPR_HOST}:${DAPR_HTTP_PORT}/orders`, order, axiosConfig);
        console.log("Order passed: " + serviceResult.config.data);
        res.sendStatus(200);
    });


    app.listen(port, () => console.log(`Node App listening on port ${port}!`));
}

start();
