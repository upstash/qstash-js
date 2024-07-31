<script>
    import { writable } from 'svelte/store';

    // Hardcoded URL and payload
    const url = 'http://localhost:5173/api';
    const payload = { key: 'value' };

    let result = writable('');

    async function sendRequest() {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            const data = await response.text();
            result.set(JSON.stringify(data, null, 2));
        } catch (error) {
            result.set(`Error: ${error.message}`);
        }
    }
</script>

<main>
    <h1>Send POST Request</h1>
    <button on:click={sendRequest}>Send Request</button>

    <h2>Result:</h2>
    <pre>{$result}</pre>
</main>

<style>
    main {
        font-family: Arial, sans-serif;
        padding: 20px;
        max-width: 600px;
        margin: 0 auto;
    }
    button {
        padding: 10px 15px;
        background-color: #007BFF;
        color: white;
        border: none;
        cursor: pointer;
    }
    button:hover {
        background-color: #0056b3;
    }
    pre {
        background-color: #f8f8f8;
        padding: 10px;
        border: 1px solid #ddd;
    }
</style>
