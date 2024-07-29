# QStash Nuxt Example

This example highlights how one can define an endpoint in Nuxt and make sure that only the requests coming from QStash are accepted.

To see how the endpoint is defined, see the `server/api/endpoint.ts` file.

## Local Development

To install `@upstash/qstash` in your project, run:

```
npm install @upstash/qstash
```

Then, add the environment variables `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY`. You can find their values from [the Upstash Console](https://console.upstash.com/qstash).

Next, run the app with:

```
npm run dev
```

Once you have the app deployed, you can try going to our endpoint at http://localhost:3000/api/endpoint and see that it returns what we expect:

```
{
  "status": 403,
  "body": "`Upstash-Signature` header is missing"
}
```

To check that requests coming from QStash are accepted, we first start a local tunnel with ngrok:

```
ngrok http http://localhost:3000
```

Then, we publish a message at QStash to the ngrok endpoint (replace `NGROK_URL` and `QSTASH_TOKEN` with your own values.):

```
curl -X POST "https://qstash.upstash.io/v2/publish/<NGROK_URL>" \
  -H "Authorization: Bearer <QSTASH_TOKEN>" \
  -H "Content-Type: application/json" \
  -H "Upstash-Method: POST" \
  -H "Upstash-Delay: 10s" \
  -H "Upstash-Retries: 3" \
  -H "Upstash-Forward-Custom-Header: custom-value" \
  -d '{"message":"Hello, World!"}'
```
