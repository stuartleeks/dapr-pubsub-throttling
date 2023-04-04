import axios from "axios";
import { program } from "commander";

// Load the .env file if it exists
import * as dotenv from "dotenv";
import nanoid from "nanoid";
dotenv.config();

const DAPR_HOST = process.env.DAPR_HOST || "http://localhost";
const DAPR_HTTP_PORT = process.env.DAPR_HTTP_PORT || "3500";

const PUBSUB_NAME = process.env.PUBSUB_NAME || "pubsub";
const PUBSUB_TOPIC = process.env.QUEUE_NAME || "orders";

export async function main(): Promise<void> {

	program
		.option("-c, --count <count>", "number of messages to send")
		.option("-d, --delay <delay>", "delay between messages in milliseconds")

	program.parse();
	const options = program.opts();
	const count = options.count || 1;
	const delay = options.delay || 0;

	console.log(`Using pubsub_name: ${PUBSUB_NAME}, topic: ${PUBSUB_TOPIC}`)

	for (let i = 0; i < count; i++) {
		const id = nanoid.nanoid(5);
		const message = {
			id,
			message: "Hello World"
		};
		await publishMessage(message);

		if (delay > 0) {
			await sleep(delay);
		}
	}
}

async function publishMessage(message: any) {
	// Publish an event using Dapr pub/sub
	try {
		const response = await axios.post(`${DAPR_HOST}:${DAPR_HTTP_PORT}/v1.0/publish/${PUBSUB_NAME}/${PUBSUB_TOPIC}`, message)
		console.log("Published data: " + response.config.data);
	}
	catch (error) {
		console.log(error);
	}
}

async function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
main()
	.catch((err) => {
		console.log("Error occurred: ", err);
		process.exit(1);
	})
	.then(() => process.exit(0));


