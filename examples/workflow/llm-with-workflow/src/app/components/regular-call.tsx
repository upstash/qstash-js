import { useState, useEffect } from 'react';

async function fetchRegularResponse() {
  const response = await fetch("/api/regular", { method: "POST" })
  return await response.json()
}

export default function RegularCall({ state, setState }: { state: number, setState: (val: number) => void }) {
  const [response, setResponse] = useState("idle");

  useEffect(() => {
    if (state === 2) {
      setResponse("pending...")
      fetchRegularResponse().then((data) => {
        setResponse(JSON.stringify(data));
        // @ts-expect-error
        setState((prevState) => prevState - 1); // Decrement state by 1
      });
    }
  }, [state, setState]);

  return (
    <div className="p-4 border border-gray-300 rounded">
      <p>Regular Call: {response}</p>
    </div>
  );
}
