import { useState, useEffect } from 'react';
import { CallInfo, RedisEntry } from '../utils/constants';
import ResultInfo from './result';

async function fetchRegularResponse({ prompt }: { prompt: string }) {
  const response = await fetch(
    "/api/regular",
    {
      method: "POST",
      body: JSON.stringify({prompt})
    });
  if (response.status === 429) {
    throw new Error("Your request was rejected because you surpassed the ratelimit. Please try again later.")
  }
  return await response.json() as RedisEntry;
}

export default function RegularCall({
  state,
  setState,
  onScrollClick
}: {
  state: number,
  setState: (val: number) => void,
  onScrollClick: () => void
}) {
  const [response, setResponse] = useState<CallInfo>({
    empty: true, duration: 0, functionTime: 0, result: ""
  });
  const [activeKey, setActiveKey] = useState<string | string[]>();

  useEffect(() => {
    if (state === 2) {
      setActiveKey(undefined);
      setResponse({...response, empty: true, result: "pending..."});
      fetchRegularResponse({
        prompt: "A supersonic jet rising to the stars in 1980s propaganda posters style,. as color, use a contrast between a calm white/blue and a striking red"
      })
        .then((data) => {
          setResponse({
            empty: false,
            duration: Number(data.time),
            functionTime: Number(data.time),
            result: data.url
          });
          setActiveKey("1"); // Open the collapse panel

          // @ts-expect-error this works but raises error
          setState((prevState) => prevState - 1); // Decrement state by 1
        })
        .catch(error => {
          setResponse({...response, empty: true, result: "You are rate limited. Please retry later"})
          console.error(error)
          // @ts-expect-error this works but raises error
          setState((prevState) => prevState - 1); // Decrement state by 1
        })
    }
  }, [state, setState]);

  return (
    <ResultInfo
      title='Regular'
      isWorkflow={false}
      activeKey={activeKey}
      setActiveKey={setActiveKey}
      state={state} 
      response={response}
      onScrollClick={onScrollClick}
    />
  );
}
