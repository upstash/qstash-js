# QStash Workflow Cloudflare Workers Example

This is an example of how to use QStash Workflow with Cloudflare Workers. You can learn more in [Workflow documentation for Cloudflare Workers](https://upstash.com/docs/qstash/workflow/quickstarts/cloudflare-workers).

## Development

> [!TIP]
> You can use [the `bootstrap.sh` script](https://github.com/upstash/qstash-js/tree/main/examples/workflow) to run this example with a local tunnel.
>
> Simply set the environment variables as explained below and run the following command in the `qstash-js/examples/workflow` directory:
>
> ```
> bash bootstrap.sh cloudflare-workers
> ```

1. Install the dependencies

```bash
npm install
```

2. Get the credentials from the [Upstash Console](https://console.upstash.com/qstash) and add them to the `.dev.vars` file.

```bash
QSTASH_URL=
QSTASH_TOKEN=
```

3. Open a local tunnel to port of the development server

```bash
ngrok http 3001
```

Also, set the `UPSTASH_WORKLFOW_URL` environment variable to the public url provided by ngrok.

4. Run the development server

```bash
npm run dev
```

5. Send a `POST` request to the endpoint.

```bash
curl -X POST "http://localhost:3001" -d '{"text": "hello world!"}'
```

## Deployment

You can use wrangler to deploy the project to Cloudflare Workers.

```bash
npm run deploy
```
