# QStash Solid.js Example

This example highlights how one can define an endpoint in Solid.js and make sure that only the requests coming from QStash are accepted.

To see how the endpoint is defined, see the `src/routes/api/index.ts` file.

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

Once you have the app deployed, you can go to http://localhost:3000 and send a request to our endpoint (http://localhost:3000/api). Our request will be denied and the result will be `'Upstash-Signature' header is missing`.

To check that requests coming from QStash are accepted, we first start a local tunnel with ngrok:

```
ngrok http http://localhost:3000
```

Then, we publish a message at QStash to the ngrok endpoint (replace `NGROK_URL` and `QSTASH_TOKEN` with your own values.):

```
curl -X POST "https://qstash.upstash.io/v2/publish/<NGROK_URL>/api" \
  -H "Authorization: Bearer <QSTASH_TOKEN>" \
  -H "Content-Type: application/json" \
  -H "Upstash-Method: POST" \
  -H "Upstash-Retries: 2" \
  -H "Upstash-Forward-Custom-Header: custom-value" \
  -d '{"message":"Hello, World!"}'
```

Check the logs from QStash dashboard at Upstash Console to see that the request was completed successfully.
