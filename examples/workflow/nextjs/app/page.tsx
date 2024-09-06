"use client"

import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function Home() {
  const [requestBody, setRequestBody] = useState('{"date":123,"email":"my@mail.com","amount":10}');
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();

  const search = searchParams.get('function');
  const [route, setRoute] = useState(search ?? "path");

  const routes = ['path', 'sleep', 'sleepWithoutAwait', 'northStarSimple', 'northStar', 'call'];

  const handleSend = async () => {
    setLoading(true);
    const url = `/-call-qstash`;
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json'
        },
        method: "POST",
        body: JSON.stringify({
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
    <div className='flex flex-col justify-between h-screen '>
      <div className='flex items-center justify-center w-full h-20 text-white bg-black'>
        <Image src="/upstash-dark-bg.svg" alt='upstash-logo' width={125} height={100}/>
      </div>
      <div className="flex flex-row items-center justify-center flex-grow gap-8 bg-gray-100">
        <div className='w-160'>
          <div className="w-full max-w-md p-6 rounded-xl">
            <h1 className="mb-4 text-3xl font-bold">Get Started with <br/>Upstash Workflow</h1>
            <p>
              This is a simple example to show how to use Upstash Workflow with Next.js. You can send requests to the workflow by selecting a route and providing a request body.
            </p>
            <br/>
            <p>
            Each example will have its own payload structure. To find the related payload type, navigate to the route file in the left sidebar.
            </p>
            <br/>
            <p>
              After you run the workflow, you can navigate to <a className='font-semibold text-emerald-500' href='https://console.upstash.com/qstash?tab=workflow'>Upstash Console</a> and see the related logs.
            </p>
            <Image src="/console.jpeg" alt='upstash console' height={400} width={400} className='mt-4 rounded-xl'/>
            <div className='flex w-full gap-2 mt-4'>
            
            <a className='flex items-center justify-center w-1/2 px-4 py-2 text-white transition-all rounded-md bg-zinc-800 hover:bg-emerald-400' href='https://upstash.com/docs/qstash/workflow/quickstarts/vercel-nextjs'>Docs</a>
            <a className='flex items-center justify-center w-1/2 gap-2 px-4 py-2 text-white transition-all rounded-md bg-zinc-800 hover:bg-emerald-500' href='https://github.com/upstash/qstash-js/tree/main/examples/workflow/nextjs'>
            Repository
            </a>
            </div>

          </div>
        </div>
        <div className="w-full max-w-md p-6 bg-white shadow-md rounded-xl">
          <h1 className="mb-4 text-xl font-bold">Send Request</h1>

          <div className="mb-4">
            <label className="block text-gray-700">Route:</label>
            <select
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              className="block w-full px-3 py-2 mt-1 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
              className="block w-full px-3 py-2 mt-1 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          <button
            onClick={handleSend}
            disabled={loading}
            className={`w-full px-4 py-2 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${loading ? 'bg-gray-500' : 'bg-emerald-500 hover:bg-emerald-600'}`}
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </div>
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