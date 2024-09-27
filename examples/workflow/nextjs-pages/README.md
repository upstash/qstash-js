[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fupstash%2Fqstash-js%2Ftree%2Fmain%2Fexamples%2Fworkflow%2Fnextjs-pages&env=QSTASH_TOKEN&envDescription=You%20can%20access%20this%20variable%20from%20Upstash%20Console%2C%20under%20QStash%20page.%20&project-name=qstash-workflow-nextjs&repository-name=qstash-workflow-nextjs&demo-title=Upstash%20QStash%20Workflow%20Example&demo-description=A%20Next.js%20application%20utilizing%20QStash%20Workflows)

# Upstash Workflow Nextjs (Pages Router) Example

This is an example of how to use Upstash Workflow with Nextjs (using Pages Router). You can learn more in [Workflow documentation for Nextjs](https://upstash.com/docs/qstash/workflow/quickstarts/vercel-nextjs).

In the `src/pages/api/path.sh` file, you can find out how one can define endpoints serving Upstash Workflow.

## Development

> [!TIP]
> You can use [the `bootstrap.sh` script](https://github.com/upstash/qstash-js/tree/main/examples/workflow) to run this example with a local tunnel.
>
> Simply set the environment variables as explained below and run the following command in the `qstash-js/examples/workflow` directory:
>
> ```
> bash bootstrap.sh cloudflare-workers-hono
> ```

1. Install the dependencies

```bash
npm install
```

2. Get the credentials from the [Upstash Console](https://console.upstash.com/qstash) and add them to the `.env.local` file.

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

5. Send a `POST` request to the `/api/path` endpoint.

```bash
curl -X POST "http://localhost:3001/api/path" -d 'my-payload'
```

## Deploying the Project at Vercel

To deploy the project, you can simply use the `Deploy with Vercel` button at the top of this README. If you want to edit the project and deploy it, you can read the rest of this section.

To deploy the project at vercel and try the endpoints, you should start with setting up the project by running:

```
vercel
```