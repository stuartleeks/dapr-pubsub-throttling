import axios from "axios";

// Load the .env file if it exists
import * as dotenv from "dotenv";
import nanoid from "nanoid";
dotenv.config();

const DAPR_HOST = process.env.DAPR_HOST || "http://localhost";
const DAPR_HTTP_PORT = process.env.DAPR_HTTP_PORT || "3500";
const PUBSUB_NAME = "pubsub";
const PUBSUB_TOPIC = "orders";

export async function main(): Promise<void> {

	const id = nanoid.nanoid(5);
	const body = {
		id,
		message: "Hello World"
	};

	// Publish an event using Dapr pub/sub
	await axios.post(`${DAPR_HOST}:${DAPR_HTTP_PORT}/v1.0/publish/${PUBSUB_NAME}/${PUBSUB_TOPIC}`, body)
		.then(function (response) {
			console.log("Published data: " + response.config.data);
		})
		.catch(function (error) {
			console.log(error);
		});

}

//   async function sleep(ms) {
// 	return new Promise(resolve => setTimeout(resolve, ms));
//   }
main()
	.catch((err) => {
		console.log("Error occurred: ", err);
		process.exit(1);
	})
	.then(() => process.exit(0));


