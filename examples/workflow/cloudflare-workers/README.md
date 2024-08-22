# QStash Workflow Cloudflare Workers Example

This is an example of how to use QStash Workflow with Cloudflare Workers.

## Development

To run this example, you need to open a local tunnel since QStash needs a way to call your endpoints.
Also, the first request needs to come from QStash, so you need to send a `POST` request to the `/test` endpoint
which will send a request to the `/workflow` endpoint from QStash to start the workflow.

1. Install the dependencies

```bash
npm install
```

2. Get the credentials from the [Upstash Console](https://console.upstash.com/qstash) and add them to the `.dev.vars` file.

```bash
QSTASH_URL=
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
```

3. Run the development server

```bash
npm run dev
```

4. Open a local tunnel to port of the development server

```bash
ngrok http 8787
```

5. Send a `POST` request to the `/test` endpoint of the tunnel url.

```bash
curl -X POST "https://<tunnel-url>.app/test"
```

## Deployment

You can use wrangler to deploy the project to Cloudflare Workers.

```bash
npm run deploy
```
