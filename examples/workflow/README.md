# Workflow Examples

This directory has example projects for QStash Workflows with different frameworks.

Each project has an interface where you can enter the deployment URL, pick a workflow endpoint, enter a payload and finally call the picked workflow endpoint.

## How to Run

There are three alternatives:
1. Deploy the app and use the interface to call it
2. Run the app locally and create a local tunnel with Ngrok so that QStash can call it. Doing this is simplified through the `bootstrap.sh` script.
3. If you have access to the QStash development server, run both the development server and the example workflow project locally. Unfortunetly, local QStash development server is not public.

### `bootstrap.sh` Script

First, set the environment variables `QSTASH_TOKEN`, `QSTASH_URL`, `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY`.

The `bootstrap.sh` script makes it possible to start an examplew workflow project and create a Ngrok tunnel in one script. To run it, simply choose the framework and the endpoint you would like to choose as default:

```
bash bootstrap.sh <example-framework>
```

Here is an example call:

```
bash bootstrap.sh nextjs path
```

You will still be able to use endpoints other than `path`. `path` will simply be what the home page will have as default endpoint.

Here is what the script does in a nutshell:
- create a Ngrok tunnel from `localhost:3001`
- Public URL of the tunnel is inferred from Ngrok logs.
- a web browser is opened with the picked endpoint

To use the app, simply enter the ngrok URL to the `Base URL` field of the form and send a request.

You will be able to see the workflow executing in the console logs. You can also monitor the events in [the QStash tab of Upstash Console](https://console.upstash.com/qstash?tab=events).
