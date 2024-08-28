[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fupstash%2Fqstash-js%2Ftree%2Fmain%2Fexamples%2Fworkflow%2Fnuxt&env=QSTASH_TOKEN,OPENAI_API_KEY&envDescription=OPENAI_API_KEY%20is%20only%20required%20for%20the%20%60call%60%20endpoint.%20For%20other%20endpoints%2C%20you%20can%20enter%20a%20random%20OPENAI_API_KEY%20key%20since%20it%20won't%20be%20used.&project-name=qstash-workflow&repository-name=qstash-workflow&demo-title=Upstash%20-%20QStash%20Workflow%20Example&demo-description=A%20Nuxt%20Application%20Utilizing%20QStash%20Workflows)

# QStash Workflow Nuxt Example

This project has some routes showcasing how QStash Workflow can be used in a nuxt project. You can learn more in [Workflow documentation for Nuxt](https://upstash.com/docs/qstash/workflow/quickstarts/nuxt).

Under the `server/api` directory, you will find 6 files, each corresponding to a workflow API except the `callQstash`.

Here is what these `callQstash` endpoint does: The user calls `callQstash` with information about which endpoint is to be called in the body. `callQstash` publishes a message to QStash. QStash then calls the specified endpoint.

![flow-diagram](../imgs/flow-diagram-nuxt.png)

To run the app locally, first set the environment variables `QSTASH_URL`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY`. You can find the values of the env variables from the [Upstash Console](https://console.upstash.com/qstash). `QSTASH_URL` should be `https://qstash.upstash.io`.

> [!WARNING]
> When adding workflow to your own app, don't forget to add `QSTASH_URL`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY` to `nuxt.config.ts`:
> 
> ```diff
> // nuxt.config.ts
> export default defineNuxtConfig({
>   compatibilityDate: '2024-04-03',
>   devtools: { enabled: true },
> + runtimeConfig: {
> +   QSTASH_URL: process.env.QSTASH_URL,
> +   QSTASH_TOKEN: process.env.QSTASH_TOKEN,
> +   QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY,
> +   QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY,
> + },
>   css: ['~/assets/css/main.css'],
>   postcss: {
>     plugins: {
>       tailwindcss: {},
>       autoprefixer: {},
>     },
>   },
> })
> ```

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
