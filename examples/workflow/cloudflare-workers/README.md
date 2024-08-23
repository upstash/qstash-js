# QStash Workflow Cloudflare Workers Example

This is an example of how to use QStash Workflow with Cloudflare Workers.

## Development

To run this example, you need to open a local tunnel since QStash needs a way to call your endpoints. For the purposes of this example, you should set the UPSTASH_WORKFLOW_URL environment variable to the public URL of your local tunnel. You can use [the bootstrap.sh script to handle this for you](https://github.com/upstash/qstash-js/tree/main/examples/workflow):

```
bash bootstrap.sh cloudflare-workers
```

1. Install the dependencies

```bash
npm install
```

2. Get the credentials from the [Upstash Console](https://console.upstash.com/qstash) and add them to the `.dev.vars` file.

```bash
QSTASH_URL=
QSTASH_TOKEN=
```

3. Run the development server

```bash
npm run dev
```

4. Open a local tunnel to port of the development server

```bash
ngrok http 3001
```

5. Send a `POST` request to the `/workflow` endpoint of the tunnel url.

```bash
curl -X POST "https://<tunnel-url>.app/workflow" -d '{"text": "hello world!"}'
```

## Deployment

You can use wrangler to deploy the project to Cloudflare Workers.

```bash
npm run deploy
```
