<template>
  <main class="min-h-screen">
    <div class="max-w-screen-sm px-8 pt-16 mx-auto pb-44">
      <!-- Header -->
      <header>
        <img
          class="w-10 mb-8"
          src="/upstash-logo.svg"
          alt="upstash logo"
          width="40"
          height="40"
        />

        <h1 class="text-2xl font-semibold text-balance">
          Get Started with Upstash Workflow
        </h1>
        <h2 class="text-lg text-balance opacity-60">
          This is a simple example to demonstrate Upstash Workflow with
          Nuxt.js. Start a workflow by selecting a route and providing a
          request body.
        </h2>

        <div class="flex flex-wrap items-center gap-2 mt-4">
          <a
            class="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-md hover:bg-emerald-100"
            href="https://upstash.com/docs/qstash/workflow/quickstarts/vercel-nextjs"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
              <path d="M14 3v4a1 1 0 0 0 1 1h4" />
              <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" />
              <path d="M10 13l-1 2l1 2" />
              <path d="M14 13l1 2l-1 2" />
            </svg>
            Docs
          </a>
          <a
            class="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-md hover:bg-emerald-100"
            href="https://github.com/upstash/qstash-js/tree/main/examples/workflow/nextjs"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
              <path d="M9 19c-4.3 1.4 -4.3 -2.5 -6 -3m12 5v-3.5c0 -1 .1 -1.4 -.5 -2c2.8 -.3 5.5 -1.4 5.5 -6a4.6 4.6 0 0 0 -1.3 -3.2a4.2 4.2 0 0 0 -.1 -3.2s-1.1 -.3 -3.5 1.3a12.3 12.3 0 0 0 -6.2 0c-2.4 -1.6 -3.5 -1.3 -3.5 -1.3a4.2 4.2 0 0 0 -.1 3.2a4.6 4.6 0 0 0 -1.3 3.2c0 4.6 2.7 5.7 5.5 6c-.6 .6 -.6 1.2 -.5 2v3.5" />
            </svg>
            Repository
          </a>
        </div>
      </header>

      <!-- Step-by-step -->
      <div class="mt-16 md:mt-16">
        <!-- Step 1 -->
        <div class="relative pb-16 pl-6 border-l-2 border-l-zinc-200 last:pb-0 sm:ml-4 sm:pl-8 dark:border-l-zinc-900">
          <span class="absolute top-0 left-0 h-6 sm:h-8">
            <span class="absolute flex items-center justify-center text-center -translate-x-1/2 -translate-y-1/2 border-4 border-white rounded-full left-1/2 top-1/2 size-8 sm:size-10 bg-zinc-100">
              <span class="font-mono text-sm font-semibold opacity-60">0</span>
            </span>
          </span>

          <h3 class="font-semibold sm:text-lg">Local development with ngrok</h3>
          <div class="opacity-60">
            <p>
              Upstash Workflow require a publicly accessible API endpoint to
              function.
            </p>
            <p class="underline">
              if you are not working on local server, skip this step.
            </p>
          </div>

          <div class="mt-6">
            <a
              class="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-md hover:bg-emerald-100"
              href="https://upstash.com/docs/qstash/workflow/howto/local-development"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6" />
                <path d="M11 13l9 -9" />
                <path d="M15 4h5v5" />
              </svg>
              ngrok setup
            </a>
          </div>
        </div>

        <!-- Step 2 -->
        <div class="relative pb-16 pl-6 border-l-2 border-l-zinc-200 last:pb-0 sm:ml-4 sm:pl-8 dark:border-l-zinc-900">
          <span class="absolute top-0 left-0 h-6 sm:h-8">
            <span class="absolute flex items-center justify-center text-center -translate-x-1/2 -translate-y-1/2 border-4 border-white rounded-full left-1/2 top-1/2 size-8 sm:size-10 bg-zinc-100">
              <span class="font-mono text-sm font-semibold opacity-60">1</span>
            </span>
          </span>

          <h3 class="font-semibold sm:text-lg">Send Request</h3>
          <div class="opacity-60">
            Each example has its own payload structure. To find the related
            payload type, navigate to the corresponding route file in your
            left sidebar.
          </div>

          <div class="mt-6">
            <form
              @submit.prevent="handleSend"
              class="grid gap-4 p-6 rounded-xl bg-emerald-500/10"
            >
              <div>
                <label class="text-xs uppercase opacity-60">Route</label>
                <select
                  v-model="route"
                  class="block w-full h-8 px-2 mt-1 bg-white border border-gray-300 rounded-md"
                >
                  <option value="" disabled>Select route</option>
                  <option v-for="r in routes" :key="r" :value="r">{{ r }}</option>
                </select>
              </div>

              <div>
                <label class="text-xs uppercase opacity-60">Body</label>
                <textarea
                  v-model="requestBody"
                  rows="2"
                  class="block w-full px-2 py-2 mt-1 bg-white border border-gray-300 rounded-md"
                ></textarea>
              </div>

              <div>
                <button
                  type="submit"
                  :disabled="loading"
                  :class="loading ? 'opacity-30' : ''"
                  class="h-8 px-4 text-white rounded-md bg-emerald-500"
                >
                  {{ loading ? 'Sending...' : 'Send' }}
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- Step 3 -->
        <div class="relative pb-16 pl-6 border-l-2 border-l-zinc-200 last:pb-0 sm:ml-4 sm:pl-8 dark:border-l-zinc-900">
          <span class="absolute top-0 left-0 h-6 sm:h-8">
            <span class="absolute flex items-center justify-center text-center -translate-x-1/2 -translate-y-1/2 border-4 border-white rounded-full left-1/2 top-1/2 size-8 sm:size-10 bg-zinc-100">
              <span class="font-mono text-sm font-semibold opacity-60">2</span>
            </span>
          </span>

          <h3 class="font-semibold sm:text-lg">See Logs in Upstash Console</h3>
          <div class="opacity-60">
            After running a workflow, navigate to the Upstash Console to see
            the related logs.
          </div>

          <div class="mt-6">
            <a
              class="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-md hover:bg-emerald-100"
              href="https://console.upstash.com/qstash?tab=workflow"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6" />
                <path d="M11 13l9 -9" />
                <path d="M15 4h5v5" />
              </svg>
              Upstash Console
            </a>

            <img
              class="block mt-4"
              src="/ss.png"
              width="1564"
              height="476"
              alt="Upstash Console Screenshot"
            />
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup>
import { ref } from 'vue';

const requestBody = ref('{"date":123,"email":"my@mail.com","amount":10}');
const loading = ref(false);
const route = ref('path');
const routes = ['path', 'sleep', 'sleepWithoutAwait', 'northStarSimple', 'northStar', 'call'];

const handleSend = async () => {
  loading.value = true;
  const url = "/api/callQstash";
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      method: "POST",
      body: JSON.stringify({
        route: route.value,
        payload: JSON.parse(requestBody.value),
      }),
    });
    console.log('Response:', await response.json());
  } catch (error) {
    console.error('Error:', error);
  } finally {
    loading.value = false;
  }
};
</script>