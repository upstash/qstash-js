import { useState, useEffect } from 'react';
import { CallInfo } from '../utils/constants';
import ResultInfo from './result';

async function fetchRegularResponse() {
  const response = await fetch("/api/regular", { method: "POST" });
  return await response.json() as { time: number, result: string };
}

export default function RegularCall({ state, setState }: { state: number, setState: (val: number) => void }) {
  const [response, setResponse] = useState<CallInfo>({
    empty: true, duration: 0, functionTime: 0, result: ""
  });
  const [activeKey, setActiveKey] = useState<string | string[]>();

  useEffect(() => {
    if (state === 2) {
      setActiveKey(undefined);
      setResponse({...response, empty: true, result: "pending..."});
      fetchRegularResponse().then((data) => {
        setResponse({
          empty: false,
          duration: data.time,
          functionTime: data.time,
          result: data.result
        });
        // setCollapseDisabled(false); // Enable collapse when response is set
        setActiveKey("1"); // Open the collapse panel
        // @ts-expect-error
        setState((prevState) => prevState - 1); // Decrement state by 1
      });
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
    />
  );
}
