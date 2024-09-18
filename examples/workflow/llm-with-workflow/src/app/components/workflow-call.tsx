import { useState, useEffect } from 'react';
import { CallInfo, REDIS_PREFIX, RedisEntry } from '../utils/constants';
import ResultInfo from './result';

async function triggerWorkflow(key: string) {
  const response = await fetch("/api/workflow", { method: "POST", body: key });
  if (response.status === 429) {
    throw new Error("Your request was rejected because you surpassed the ratelimit. Please try again later.")
  }
}

async function checkRedisForResult(key: string) {
  const response = await fetch("/api/check-workflow", { method: "POST", body: key });
  const result = (await response.json()) as RedisEntry;
  return result;
}

export default function WorkflowCall({
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
  const key = `${REDIS_PREFIX}-${Math.ceil(Math.random() * 1000000)}`;

  useEffect(() => {
    if (state === 2) {
      const startTime = performance.now()
      let checkCount = 0

      setActiveKey(undefined);
      setResponse({...response, empty: true, result: "pending..."});
      triggerWorkflow(key)
        .then(() => {
          const pollData = async () => {
            if (checkCount > 45) {
              const errorMessage = "Workflow request got timeout. Please try again later."
              setResponse({...response, empty: true, result: errorMessage})
              return
            }
            const result = await checkRedisForResult(key);
            checkCount += 1;
            setResponse({...response, empty: true, result: "waiting for workflow to finish..."});
            
            if (!result) {
              setTimeout(pollData, 1000);
            } else {
              // setCollapseDisabled(false); // Enable collapse when result is available
              setActiveKey("1"); // Open the collapse panel
              setResponse({
                empty: false,
                duration: performance.now() - startTime,
                functionTime: Number(result.time),
                result: result.result
              });
              // @ts-expect-error this works but shows an error
              setState((prevState) => prevState - 1); // Decrement state by 1
            }
          };

          pollData();
        })
        .catch(error => {
          setResponse({...response, empty: true, result: "You are rate limited. Please retry later"})
          console.error(error)
          // @ts-expect-error
          setState((prevState) => prevState - 1); // Decrement state by 1
        })
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
      onScrollClick={onScrollClick}
    />
  );
}
