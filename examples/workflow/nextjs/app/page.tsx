"use client"

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function Home() {
  const [baseUrl, setBaseUrl] = useState("http://localhost:3000");
  const [requestBody, setRequestBody] = useState('{"date":123,"email":"my@mail.com","amount":10}');
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();

  // Ensure baseUrl doesn't have a trailing slash
  useEffect(() => {
    if (baseUrl.endsWith('/')) {
      setBaseUrl(baseUrl.replace(/\/$/, ''));
    }
  }, [baseUrl]);

  const search = searchParams.get('function');
  const [route, setRoute] = useState(search ?? "path");

  const routes = ['path', 'sleep', 'sleepWithoutAwait', 'northStarSimple', 'northStar', 'call'];

  const handleSend = async () => {
    setLoading(true);
    const url = `${baseUrl}/-call-qstash`;
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json'
        },
        method: "POST",
        body: JSON.stringify({
          baseUrl,
          route,
          payload: JSON.parse(requestBody)
        })
      });
      console.log('Response:', await response.json());
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded shadow-md w-full max-w-md">
        <h1 className="text-xl font-bold mb-4">Send Request</h1>

        <div className="mb-4">
          <label className="block text-gray-700">Base URL (replace with deployment URL):</label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700">Route:</label>
          <select
            value={route}
            onChange={(e) => setRoute(e.target.value)}
            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            <option value="" disabled>Select route</option>
            {routes.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-gray-700">Request Body:</label>
          <textarea
            value={requestBody}
            onChange={(e) => setRequestBody(e.target.value)}
            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={loading}
          className={`w-full px-4 py-2 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${loading ? 'bg-gray-500' : 'bg-blue-500 hover:bg-blue-600'}`}
        >
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense>
      <Home/>
    </Suspense>
  )
}