# dapr-pubsub-throttling

A repo to experiment with options for throttling calls from a pubsub subscriber to an API

The repo contains a dev container for use with VS Code that contains all the dependencies needed.

There are various projects under the `src` folder

| Name               | Desc                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| publisher          | An app that publishes messages for the subscriber to consume. Messages are published via pubsub component    |
| publisher-console  | An app that publishes messages for the subscriber to consume. Messages are published directly to Service Bus |
| subscriber         | A service that subscribes to pubsub and invokes the processing-service                                       |
| processing-service | A simple fake service for subscriber to call. Sleeps for 200ms and has rate limiting applied in config       |


## Running  locally

Before running services locally, run `dapr init` to initialize dapr.

To run the processing-service, launch a terminal and run `just run-processing-service`.

Similarly, to run the subscriber, launch a terminal and run `just run-subscriber-simple`. (To run the token-bucket version, run `just run-subscriber-token-bucket` instead.)

To publish messages use the publisher:

```bash
# publish a single message
just publish-message-local

# publish multiple (10) messages
just publish-message-local 10
```

## Subscriber - token bucket

In subscriber, there are two different handlers implemented - see the comments in `index.ts`.

One handler just applies retries based on the 429 responses. When using this handler you will notice that processing a number of messages at once results in the first call to processing-service returning a 429 and then the subscriber waits before submitting a successful call.

The other handler uses a token bucket to limit the rate at which calls are sent to the processing-service. When using this handler, you will see that most messages only require a single call to the processing-service to complete.


## Configuring rate-limit

The rate limit configuration is in `components/ratelimit.yml`. If you change the rate limit there, also change the `TokenBucket` configuration in `src/subscriber/index.ts` to match.

## Configuring concurrency

The subscriber service is currently limited to a single concurrent message processor.

This works well for the 1 RPS scenario, but may need tuning for higher throughputs. The configuration is in `components/pubsub.yml`.

