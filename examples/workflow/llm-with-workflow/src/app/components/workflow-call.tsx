
import { useState, useEffect } from 'react';
import { REDIS_PREFIX, RedisEntry } from '../utils/constants';

async function triggerWorkflow(key: string) {
  await fetch("/api/workflow", { method: "POST", body: key })
}


async function checkRedisForResult(key: string) {
  const response = await fetch("/api/check-workflow", { method: "POST", body: key })
  const result = await response.json() as RedisEntry
  
  return result
}

export default function WorkflowCall({ state, setState }: { state: number, setState: (val: number) => void }) {
  const [response, setResponse] = useState("idle");
  const key = `${REDIS_PREFIX}-${Math.ceil(Math.random() * 1000000)}`

  useEffect(() => {
    if (state === 2) {
      // Fetch initial data
      setResponse("pending...")
      triggerWorkflow(key).then((data) => {
        // Start polling until finish is true
        const pollData = async () => {
          const result = await checkRedisForResult(key);
          setResponse("waiting workflow to finish...")

          if (!result) {
            setTimeout(pollData, 1000); // Retry after 1 second
          } else {
            // @ts-expect-error
            setState((prevState) => prevState - 1); // Decrement state by 1
            const totalDuration = result.timestamp - performance.now()
            setResponse(JSON.stringify({totalDuration, ...result}));
          }
        };

        pollData();
      });
    }
  }, [state, setState]);

  return (
    <div className="p-4 border border-gray-300 rounded">
      <p>Workflow Result: {response}</p>
    </div>
  );
}
