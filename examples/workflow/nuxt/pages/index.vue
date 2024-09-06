<template>
  <div class="flex flex-col justify-between min-h-screen">
    <!-- Header Section -->
    <div class="flex items-center justify-center w-full h-20 text-white bg-black">
      <img src="/upstash-dark-bg.svg" alt="upstash-logo" width="125" height="100" />
    </div>

    <!-- Main Content -->
    <div class="flex flex-row items-center justify-center flex-grow gap-8 bg-gray-100">
      <!-- Left Section -->
      <div class="w-160">
        <div class="w-full max-w-md p-6 rounded-xl">
          <h1 class="mb-4 text-3xl font-bold">Get Started with <br/>Upstash Workflow</h1>
          <p>This is a simple example to show how to use Upstash Workflow with Next.js. You can send requests to the workflow by selecting a route and providing a request body.</p>
          <br />
          <p>Each example will have its own payload structure. To find the related payload type, navigate to the route file in the left sidebar.</p>
          <br />
          <p>After you run the workflow, you can navigate to 
            <a class="font-semibold text-emerald-500" href="https://console.upstash.com/qstash?tab=workflow">
              Upstash Console
            </a> and see the related logs.
          </p>
          <div class="flex gap-2 mt-4">
            <a class="flex items-center justify-center w-1/2 px-4 py-2 text-white rounded-md bg-zinc-800 hover:bg-emerald-400" href="https://upstash.com/docs/qstash/workflow/quickstarts/vercel-nextjs">Docs</a>
            <a class="flex items-center justify-center w-1/2 px-4 py-2 text-white rounded-md bg-zinc-800 hover:bg-emerald-500" href="https://github.com/upstash/qstash-js/tree/main/examples/workflow/nextjs">
              Repository
            </a>
          </div>
        </div>
      </div>

      <!-- Right Section (Send Request Form) -->
      <div class="w-full max-w-md p-6 bg-white shadow-md rounded-xl">
        <h1 class="mb-4 text-xl font-bold">Send Request</h1>

        <div class="mb-4">
          <label class="block text-gray-700">Route:</label>
          <select
            v-model="route"
            class="block w-full px-3 py-2 mt-1 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            <option value="" disabled>Select route</option>
            <option v-for="r in routes" :key="r" :value="r">{{ r }}</option>
          </select>
        </div>

        <div class="mb-4">
          <label class="block text-gray-700">Request Body:</label>
          <textarea
            v-model="requestBody"
            class="block w-full px-3 py-2 mt-1 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          ></textarea>
        </div>

        <button
          @click="handleSend"
          :disabled="loading"
          class="w-full px-4 py-2 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          :class="loading ? 'bg-gray-500' : 'bg-emerald-500 hover:bg-emerald-600'"
        >
          {{ loading ? 'Sending...' : 'Send' }}
        </button>
      </div>
    </div>
  </div>
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

<style scoped>
/* Add any extra styles here if necessary */
</style>
