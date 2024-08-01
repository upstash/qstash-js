import { createSignal } from 'solid-js';

function App() {
  // Hardcoded URL and payload
  const url = 'http://localhost:3000/api';
  const payload = { key: 'value' };

  const [result, setResult] = createSignal('');

  const sendRequest = async () => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await response.text();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(`Error: ${error.message}`);
    }
  };

  return (
    <main>
      <h1>Send POST Request</h1>
      <button onClick={sendRequest}>Send Request</button>

      <h2>Result:</h2>
      <pre>{result()}</pre>

      <style>
        {`
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
        `}
      </style>
    </main>
  );
}

export default App;
