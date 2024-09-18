import { useState, useEffect } from 'react';
import { CallInfo, REDIS_PREFIX, RedisEntry } from '../utils/constants';
import ResultInfo from './result';

async function triggerWorkflow(key: string) {
  await fetch("/api/workflow", { method: "POST", body: key });
}

async function checkRedisForResult(key: string) {
  const response = await fetch("/api/check-workflow", { method: "POST", body: key });
  const result = (await response.json()) as RedisEntry;
  return result;
}

export default function WorkflowCall({ state, setState }: { state: number, setState: (val: number) => void }) {
  const [response, setResponse] = useState<CallInfo>({
    empty: true, duration: 0, functionTime: 0, result: ""
  });
  const [activeKey, setActiveKey] = useState<string | string[]>();
  const key = `${REDIS_PREFIX}-${Math.ceil(Math.random() * 1000000)}`;

  useEffect(() => {
    if (state === 2) {
      const startTime = performance.now()

      setActiveKey(undefined);
      setResponse({...response, empty: true, result: "pending..."});
      triggerWorkflow(key).then(() => {
        const pollData = async () => {
          const result = await checkRedisForResult(key);
          setResponse({...response, empty: true, result: "waiting for workflow to finish..."});
          
          if (!result) {
            setTimeout(pollData, 1000);
          } else {
            // setCollapseDisabled(false); // Enable collapse when result is available
            setActiveKey("1"); // Open the collapse panel
            setResponse({
              empty: false,
              duration: performance.now() - startTime,
              functionTime: result.time,
              result: result.result
            });
            // @ts-expect-error
            setState((prevState) => prevState - 1); // Decrement state by 1
          }
        };

        pollData();
      });
    }
  }, [state, setState]);

  return (
    <ResultInfo
      title='Workflow'
      isWorkflow={true}
      activeKey={activeKey}
      setActiveKey={setActiveKey}
      state={state} 
      response={response}
    />
  );
}
