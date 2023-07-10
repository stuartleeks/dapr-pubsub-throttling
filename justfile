
default:
	just --list

default_count:="1"
default_handler_type:="SIMPLE"

# Run subscriber to listen for messages
run-subscriber-simple: 
	cd src/subscriber && tsc && HANDLER_TYPE=SIMPLE dapr run --app-port 3000 --app-id throttling/subscriber --app-protocol http --dapr-http-port 3500 --resources-path ../../components  --config ../../components/appconfig.yaml -- npm run start
run-subscriber-token-bucket: 
	cd src/subscriber && tsc && HANDLER_TYPE=TOKEN_BUCKET dapr run --app-port 3000 --app-id throttling/subscriber --app-protocol http --dapr-http-port 3500 --resources-path ../../components  --config ../../components/appconfig.yaml -- npm run start


# Run processing-service to listen for messages
run-processing-service:
	# "--app-max-concurrency 1" in dapr run command limits concurrency
	cd src/processing-service && tsc && dapr run  --app-port 5002 --app-id throttling-processing-service --app-protocol http --dapr-http-port 3502 --resources-path ../../components --config ../../components/appconfig.yaml -- npm run start


# Publish a message using publisher-console (send to service bus)
publish-message-servicebus count=default_count:
	cd src/publisher-console && tsc && npm run start -- --count {{count}}

# Publish a message using publisher
publish-message-local count=default_count:
	cd src/publisher && tsc && dapr run --app-port 5001 --app-id throttling/publisher --app-protocol http --dapr-http-port 3501 --resources-path ../../components -- npm run start -- --count {{count}}


# deploy (create AKS cluster, deploy dapr components, services etc)
deploy handler_type=default_handler_type:
	SUBSCRIBER_HANDLER_TYPE={{handler_type}} ./deploy.sh

# Deploy apps to k8s
deploy-to-k8s handler_type=default_handler_type:
	SUBSCRIBER_HANDLER_TYPE={{handler_type}} ./scripts/deploy-to-k8s.sh