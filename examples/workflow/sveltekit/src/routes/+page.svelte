<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { writable } from 'svelte/store';

  let requestBody = writable('{"date":123,"email":"my@mail.com","amount":10}');
  let loading = writable(false);
  let route = writable('path');

  const routes = ['path', 'sleep', 'sleepWithoutAwait', 'northStarSimple', 'northStar'];

  const handleSend = async () => {
    loading.set(true);
    const url = "/-call-qstash";
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json'
        },
        method: "POST",
        body: JSON.stringify({
          route: $route,
          payload: JSON.parse($requestBody)
        })
      });
      console.log('Response:', await response.json());
    } catch (error) {
      console.error('Error:', error);
    } finally {
      loading.set(false);
    }
  };
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-100">
  <div class="bg-white p-6 rounded shadow-md w-full max-w-md">
    <h1 class="text-xl font-bold mb-4">Send Request</h1>

    <div class="mb-4">
      <label class="block text-gray-700">Route:</label>
      <select
        bind:value={$route}
        class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
      >
        <option value="" disabled>Select route</option>
        {#each routes as r}
          <option value={r}>
            {r}
          </option>
        {/each}
      </select>
    </div>

    <div class="mb-4">
      <label class="block text-gray-700">Request Body:</label>
      <textarea
        bind:value={$requestBody}
        class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
      />
    </div>

    <button
      on:click={handleSend}
      disabled={$loading}
      class="w-full px-4 py-2 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 { $loading ? 'bg-gray-500' : 'bg-blue-500 hover:bg-blue-600' }"
    >
      { $loading ? 'Sending...' : 'Send' }
    </button>
  </div>
</div>
