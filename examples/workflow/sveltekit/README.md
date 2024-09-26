[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fupstash%2Fqstash-js%2Ftree%2Fmain%2Fexamples%2Fworkflow%2Fsveltekit&env=QSTASH_TOKEN&envDescription=You%20can%20access%20this%20variable%20from%20Upstash%20Console%2C%20under%20QStash%20page.%20&project-name=qstash-workflow-sveltekit&repository-name=qstash-workflow-sveltekit&demo-title=Upstash%20QStash%20Workflow%20Example&demo-description=A%20Svelte%20application%20utilizing%20QStash%20Workflows)

# Upstash Workflow Sveltekit Example

This project has some routes showcasing how Upstash Workflow can be used in a sveltekit project. You can learn more in [Workflow documentation for Svelte](https://upstash.com/docs/qstash/workflow/quickstarts/svelte).

Under the `src/routes` directory, you will find 6 folders, each corresponding to a workflow API except the `-call-qstash`. In each of these folders, you will find the `+server.ts` file which defines the workflow.

Here is what these `-call-qstash` endpoint does: The user calls `-call-qstash` with information about which endpoint is to be called in the body. `-call-qstash` publishes a message to QStash. QStash then calls the specified endpoint.

![flow-diagram](../imgs/flow-diagram.png)

To run the app locally, first set the environment variables `QSTASH_URL`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY`. You can find the values of the env variables from the [Upstash Console](https://console.upstash.com/qstash). `QSTASH_URL` should be `https://qstash.upstash.io`. 

Once you have the environment variables set, you can run the project with:

```
npm run dev
```

You can go to the deployment and call the endpoints using the form on the page. Simply enter the deployment URL and pick an endpoint.

Here is an example payload you can use for invoice:

```json
{"date":123,"email":"my@mail.com","amount":10}
```

You can observe the logs at Upstash console to see your workflow operate.
