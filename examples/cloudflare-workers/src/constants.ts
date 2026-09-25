
export const CRON = "*/30 * * * *"
export const DESTINATION = "https://qstash-js-ci.requestcatcher.com/"

// Body published to the worker's own /verify endpoint in the delivery round-trip test.
export const VERIFY_BODY = { hello: "qstash-js cloudflare ci" }
