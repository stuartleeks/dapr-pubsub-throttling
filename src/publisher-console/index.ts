import { ServiceBusClient, ServiceBusSender, ServiceBusMessage } from "@azure/service-bus";
import { program } from "commander";
import nanoid from "nanoid";

// Load the .env file if it exists
import * as dotenv from "dotenv";
dotenv.config();



const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
const queueName = process.env.QUEUE_NAME || "orders";

export async function main(): Promise<void> {

	program
		.option("-c, --count <count>", "number of messages to send")
		.option("-d, --delay <delay>", "delay between messages in milliseconds")

	program.parse();
	const options = program.opts();
	const count = options.count || 1;
	const delay = options.delay || 0;

	if (!connectionString) {
		throw new Error("SERVICE_BUS_CONNECTION_STRING must be set.");
	}
	if (!queueName) {
		throw new Error("QUEUE_NAME must be set.");
	}
	console.log("Create client...");
	const sbClient = new ServiceBusClient(connectionString);
	console.log("Create sender...");
	const sender = sbClient.createSender(queueName);

	for (let i = 0; i < count; i++) {
		const id = nanoid.nanoid(5);
		const message = {
			id,
			message: "Hello World"
		};
		await publishMessage(sender, message);

		if (delay > 0) {
			await sleep(delay);
		}
	}

	console.log("Done");
}

async function publishMessage(sender: ServiceBusSender, message: any) {
	const sbMessage: ServiceBusMessage = {
		body: message,
		contentType: "application/json",
	};
	console.log(`Send message... ${sbMessage.body.id}`);
	await sender.sendMessages(sbMessage);
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
