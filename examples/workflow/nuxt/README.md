# Qstash Workflow Nuxt Example

This project has some routes showcasing how Qstash Workflow can be used in a nuxt project.

Under the `server/api` directory, you will find 5 files, each corresponding to a workflow API.

To run the app locally, first set the environment variables `QSTASH_URL` and `QSTASH_TOKEN`. You can find the values of the env variables from the [Upstash Console](https://console.upstash.com/qstash). `QSTASH_URL` should be `https://qstash.upstash.io`.

> [!WARNING]
> When adding workflow to your own app, don't forget to add `QSTASH_URL` and `QSTASH_TOKEN` to `nuxt.config.ts`:
> 
> ```diff
> // nuxt.config.ts
> export default defineNuxtConfig({
>   compatibilityDate: '2024-04-03',
>   devtools: { enabled: true },
> + runtimeConfig: {
> +   QSTASH_URL: process.env.QSTASH_URL,
> +   QSTASH_TOKEN: process.env.QSTASH_TOKEN,
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
{"date":123,"email":"adss","amount":10}
```

You can observe the logs at Upstash console to see your workflow operate.
