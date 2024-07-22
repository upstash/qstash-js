# Qstash Workflow Examples

This project has some routes showcasing how Qstash Workflow can be used in a nextjs project.

Under the app directory, you will find 5 folders, each corresponding to a workflow API.

In each of these folders, you will find the `route.ts` file which defines the workflow.

## Deploying the Project at Vercel

To deploy the project at vercel and try the endpoints, you should start with setting up the project by running:

```
vercel
```

Next, you shoud go to vercel.com, find your project and add `QSTASH_URL` and `QSTASH_TOKEN` to the project as environment variables. You can find these env variables from the [Upstash Console](https://console.upstash.com/qstash). `QSTASH_URL` should be `https://qstash.upstash.io`

At this point, if you are using a released `@upstash/qstash` version, you can deploy the project with `vercel --prod`. If you are going to deploy the project with an `@upstash/qstash` version which is not released yet, you can go to the branch and run:

```
cd ../../..

npm install
npm run build

cd examples/workflow/nextjs

npm install @upstash/qstash@file:../../../dist

vercel build --prod
vercel --prebuilt --prod
```

This will go to the parent directory, build `@upstash/qstash`, install it in the workflow example project and deploy to Vercel.

Once you have the app deployed, you can go to the deployment and call the endpoints using the form on the page. Simply enter the deployment URL and pick an endpoint.

Here is an example payload you can use for invoice:

```json
{"date":123,"email":"adss","amount":10}
```

You can observe the logs at Upstash console or vercel.com to see your workflow operate.
