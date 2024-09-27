[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fupstash%2Fqstash-js%2Ftree%2Fmain%2Fexamples%2Fworkflow%2Fimage-gen-with-workflow&env=UPSTASH_REDIS_REST_URL,UPSTASH_REDIS_REST_TOKEN,QSTASH_TOKEN,IDEOGRAM_API_KEY&envDescription=You%20can%20access%20the%20QSTASH_TOKEN%20env%20variable%20from%20Upstash%20Console%2C%20under%20QStash%20page.%20You%20can%20get%20Redis%20keys%20after%20creating%20a%20Redis%20database%20from%20Upstash%20Console.&project-name=upstash-workflow-image-gen&repository-name=upstash-workflow-image-gen&demo-title=Optimizing%20Vercel%20Functions%20With%20Upstash%20Workflow&demo-description=This%20demo%20shows%20the%20cost-saving%20benefits%20of%20using%20Upstash%20Workflow%20for%20Vercel%20functions.&demo-url=https%3A%2F%2Fimage-gen-with-workflow.vercel.app%2F&demo-image=https%3A%2F%2Fimage-gen-with-workflow.vercel.app%2Flanding.png)

# Upstash Workflow - Vercel Function Cost Comparison Example

This project showcases how Upstash Workflow can reduce Vercel Function runtime costs. This is achieved by letting Upstash Workflow call an external endpoint instead of calling it in a Vercel Function and waiting.

In this example, the external endpoint is Ideogram which takes around 20 seconds to return a response.

See the demo at https://image-gen-with-workflow.vercel.app for more information.

For more information about Upstash Workflow, you can refer [to the Upstash Workflow documentation](https://upstash.com/docs/qstash/workflow/getstarted).

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

If you set `IDEOGRAM_API_KEY`, the app will call Ideogram. To make the app work with OpenAI "dall-e-2" model, set `OPENAI_API_KEY` env variable instead of `IDEOGRAM_API_KEY`. If you want to simply develop the app, you can leave both env variables empty; the app will return a mock url as image.
