[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fupstash%2Fqstash-js%2Ftree%2Fmain%2Fexamples%2Fworkflow%2Fnextjs&env=QSTASH_TOKEN,OPENAI_API_KEY&envDescription=OPENAI_API_KEY%20is%20only%20required%20for%20the%20%60call%60%20endpoint.%20For%20other%20endpoints%2C%20you%20can%20enter%20a%20random%20OPENAI_API_KEY%20key%20since%20it%20won't%20be%20used.&project-name=qstash-workflow&repository-name=qstash-workflow&demo-title=Upstash%20-%20QStash%20Workflow%20Example&demo-description=A%20Next.js%20Application%20Utilizing%20QStash%20Workflows)

# QStash Workflow Nextjs Example

This project has some routes showcasing how QStash Workflow can be used in a nextjs project. You can learn more in [Workflow documentation for Nextjs](https://upstash.com/docs/qstash/workflow/quickstarts/vercel-nextjs).

Under the app directory, you will find 8 folders, each corresponding to a workflow API except the `-call-qstash`. In each of these folders, you will find the `route.ts` file which defines the workflow.

The user calls `-call-qstash` with information about which endpoint is to be called in the body. `-call-qstash` publishes a message to QStash. QStash then calls the specified endpoint.

![flow-diagram](../imgs/flow-diagram.png)

## Deploying the Project at Vercel

To deploy the project, you can simply use the `Deploy with Vercel` button at the top of this README. If you want to edit the project and deploy it, you can read the rest of this section.

To deploy the project at vercel and try the endpoints, you should start with setting up the project by running:

```
vercel
```

Next, you shoud go to vercel.com, find your project and add `QSTASH_URL`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY` to the project as environment variables. You can find these env variables from the [Upstash Console](https://console.upstash.com/qstash). `QSTASH_URL` should be `https://qstash.upstash.io`

At this point, if you are using a released `@upstash/qstash` version, you can deploy the project with `vercel --prod`. If you are going to deploy the project with an `@upstash/qstash` version which is not released yet, you can go to the branch and run:

```
cd ../../..

bun install
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
{"date":123,"email":"my@mail.com","amount":10}
```

You can observe the logs at Upstash console or vercel.com to see your workflow operate.
