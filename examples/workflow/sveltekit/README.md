# Qstash Workflow Sveltekit Example

This project has some routes showcasing how Qstash Workflow can be used in a sveltekit project.

Under the `src/routes` directory, you will find 5 folders, each corresponding to a workflow API.

In each of these folders, you will find the `+server.ts` file which defines the workflow.

To run the app locally, first set the environment variables `QSTASH_URL` and `QSTASH_TOKEN`. You can find the values of the env variables from the [Upstash Console](https://console.upstash.com/qstash). `QSTASH_URL` should be `https://qstash.upstash.io`. 

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
