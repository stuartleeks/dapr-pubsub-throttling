
default:
	just --list


# Publish a message using publisher
run-publisher:
	cd src/publisher && tsc && dapr run --app-port 5001 --app-id publisher --app-protocol http --dapr-http-port 3501 --resources-path ../../components -- npm run start


# Run subscriber to listen for messages
run-subscriber:
	cd src/subscriber && tsc && dapr run --app-port 3000 --app-id subscriber --app-protocol http --dapr-http-port 3500 --resources-path ../../components -- npm run start


# Run processing-service to listen for messages
run-processing-service:
	cd src/processing-service && tsc && dapr run --app-port 5002 --app-id processing-service --app-protocol http --dapr-http-port 3502 --resources-path ../../components -- npm run start
