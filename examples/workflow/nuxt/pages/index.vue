<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100">
    <div class="bg-white p-6 rounded shadow-md w-full max-w-md">
      <h1 class="text-xl font-bold mb-4">Send Request</h1>

      <div class="mb-4">
        <label class="block text-gray-700">Base URL:</label>
        <input
          v-model="baseUrl"
          type="text"
          class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>

      <div class="mb-4">
        <label class="block text-gray-700">Route:</label>
        <select
          v-model="route"
          class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        >
          <option value="" disabled>Select route</option>
          <option v-for="r in routes" :key="r" :value="r">
            {{ r }}
          </option>
        </select>
      </div>

      <div class="mb-4">
        <label class="block text-gray-700">Request Body:</label>
        <textarea
          v-model="requestBody"
          class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>

      <button
        @click="handleSend"
        :disabled="loading"
        class="w-full px-4 py-2 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        :class="[loading ? 'bg-gray-500' : 'bg-blue-500 hover:bg-blue-600']"
      >
        {{ loading ? 'Sending...' : 'Send' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const baseUrl = ref('http://localhost:3000');
const requestBody = ref('{"date":123,"email":"adss","amount":10}');
const loading = ref(false);
const route = ref('path');
const routes = ['path', 'sleep', 'sleepWithoutAwait', 'northStarSimple', 'northStar'];

const handleSend = async () => {
  loading.value = true;
  const url = `${baseUrl.value}/api/${route.value}`;
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json'
      },
      method: "POST",
      body: requestBody.value
    });
    console.log('Response:', await response.json());
  } catch (error) {
    console.error('Error:', error);
  } finally {
    loading.value = false;
  }
};
</script>
