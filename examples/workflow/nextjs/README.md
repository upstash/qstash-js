[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fupstash%2Fqstash-js%2Ftree%2Fmain%2Fexamples%2Fworkflow%2Fnextjs&env=QSTASH_TOKEN&envDescription=You%20can%20access%20this%20variable%20from%20Upstash%20Console%2C%20under%20QStash%20page.%20&project-name=qstash-workflow-nextjs&repository-name=qstash-workflow-nextjs&demo-title=Upstash%20QStash%20Workflow%20Example&demo-description=A%20Next.js%20application%20utilizing%20QStash%20Workflows)

# Upstash Workflow Nextjs Example

This project has some routes showcasing how Upstash Workflow can be used in a nextjs project. You can learn more in [Workflow documentation for Nextjs](https://upstash.com/docs/qstash/workflow/quickstarts/vercel-nextjs).

Under the app directory, you will find 7 folders, each corresponding to a workflow API except the `-call-qstash`. In each of these folders, you will find the `route.ts` file which defines the endpoint.

The user calls `-call-qstash` with information about which endpoint is to be called in the body. `-call-qstash` publishes a message to QStash. QStash then calls the specified endpoint.

![flow-diagram](../imgs/flow-diagram.png)

## Deploying the Project at Vercel

To deploy the project, you can simply use the `Deploy with Vercel` button at the top of this README. If you want to edit the project and deploy it, you can read the rest of this section.

To deploy the project at vercel and try the endpoints, you should start with setting up the project by running:

```
vercel
```

Next, you shoud go to vercel.com, find your project and add `QSTASH_TOKEN`, to the project as environment variables. You can find this env variables from the [Upstash Console](https://console.upstash.com/qstash). To learn more about other env variables and their use in the context of Upstash Workflow, you can read [the Secure your Endpoint in our documentation](https://upstash.com/docs/qstash/workflow/howto/security#using-qstashs-built-in-request-verification-recommended).

Once you add the env variables, you can deploy the project with:

```
vercel --prod
```

Note that the project won't work in preview. It should be deployed to production like above. This is because preview requires authentication.

Once you have the app deployed, you can go to the deployment and call the endpoints using the form on the page.

You can observe the logs at [Upstash console under the Worfklow tab](https://console.upstash.com/qstash?tab=workflow) or vercel.com to see your workflow operate.

## Local Development

For local development setup, refer to the [Local Development section in our documentation](https://upstash.com/docs/qstash/workflow/howto/local-development).
