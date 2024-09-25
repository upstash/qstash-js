'use client'

import { useEffect, useState } from 'react'
import cx from 'utils/cx'
import { PROMPTS } from 'utils/constants'
import CallRegular from 'components/call-regular'
import CallWorkflow from 'components/call-workflow'
import Header from 'components/header'
import Button from 'components/button'

export default function Page() {
  const [start, setStart] = useState<boolean>(false)
  const [showCode, setShowCode] = useState<boolean>(false)
  const [promptIndex, setPromptIndex] = useState<number>(1)

  useEffect(() => {
    setPromptIndex(Math.floor(Math.random() * PROMPTS.length))
  }, [])

  const onGitHubClick = () => {
    window.open('https://github.com/upstash/qstash-js/tree/DX-1295-llm-cost-comparison/examples/workflow/image-gen-with-workflow', '_blank');
  }

  return (
    <main className="mx-auto min-h-screen max-w-screen-md px-8 py-12">
      <Header />

      <div className="mt-10">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => setStart(true)}
            className={cx(start && 'opacity-30')}
          >
            Start Comparison
          </Button>
          <Button variant="secondary" onClick={() => setShowCode(!showCode)}>
            Show Code
          </Button>
          <Button variant="secondary" onClick={onGitHubClick} className='flex gap-2'>
            GitHub
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="white"
              xmlns="http://www.w3.org/2000/svg"
              className='mt-[1px]'
            >
              <title>GitHub</title>
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M0.0192871 9.98062C0.0192871 11.3284 0.292716 12.6368 0.820199 13.8477C1.87485 16.3476 3.63261 18.1251 6.11316 19.1991C7.34374 19.7266 8.63277 20 9.99991 20C11.3671 20 12.6561 19.7266 13.8867 19.1991C16.3281 18.1444 18.1053 16.367 19.1796 13.8477C19.7071 12.5977 19.9805 11.289 19.9805 9.98062C19.9805 8.65254 19.7071 7.36352 19.1796 6.09387C18.1053 3.59395 16.3281 1.83619 13.8867 0.800912C12.6561 0.254055 11.3671 0 9.99991 0C8.63277 0 7.34374 0.254055 6.11316 0.800912C3.63261 1.85557 1.87485 3.61332 0.820199 6.09387C0.292716 7.32446 0.0192871 8.61348 0.0192871 9.98062ZM1.58174 9.98062C1.58174 8.84785 1.79673 7.75413 2.24578 6.69948C2.69514 5.68388 3.30043 4.78547 4.0426 4.02362C4.82382 3.26177 5.72223 2.65648 6.71845 2.22681C7.81217 1.77744 8.90588 1.56276 9.9996 1.56276C11.113 1.56276 12.187 1.77776 13.2614 2.22681C14.2967 2.67617 15.1951 3.26209 15.9372 4.02362C16.7185 4.78547 17.3044 5.68388 17.734 6.69948C18.1834 7.75413 18.3981 8.84785 18.3981 9.98062C18.3981 11.8362 17.8512 13.5158 16.7575 14.9805C15.6441 16.4648 14.2185 17.5001 12.4998 18.1251V16.5235C12.4998 15.7423 12.2264 15.1564 11.6795 14.7852C12.3436 14.7264 12.9492 14.5899 13.4961 14.3945C14.1601 14.1602 14.6876 13.828 15.0782 13.3983C15.8204 12.6365 16.1719 11.5037 16.1719 10.0194C16.1719 9.02315 15.8397 8.16381 15.1757 7.4607C15.4688 6.65979 15.4491 5.82013 15.0779 4.90203L14.8435 4.88235C14.6482 4.84329 14.3551 4.92141 13.9254 5.07765C13.4567 5.25358 12.9879 5.52701 12.4605 5.87856C11.6402 5.66357 10.8199 5.54639 10.0387 5.54639C9.25743 5.54639 8.45652 5.66357 7.63624 5.87856C6.99157 5.44889 6.42534 5.15578 5.89785 4.99953C5.70255 4.92141 5.52661 4.90172 5.39006 4.90172H4.99944C4.62821 5.81982 4.58914 6.65948 4.90163 7.46039C4.23759 8.16349 3.90542 9.02284 3.90542 10.0191C3.90542 11.9331 4.51102 13.2611 5.72192 14.0033C6.19066 14.2964 6.77658 14.5111 7.4603 14.6283C7.81186 14.7064 8.12435 14.7652 8.39777 14.7845C7.87029 15.1361 7.59686 15.722 7.59686 16.5229V18.1244C5.81942 17.4995 4.37415 16.4642 3.26106 15.0189C2.14766 13.5346 1.58143 11.8549 1.58143 9.98L1.58174 9.98062Z"
              />
            </svg>
          </Button>
        </div>

        <p className="mt-4 text-sm text-zinc-500">Prompt: {PROMPTS[promptIndex]}</p>
      </div>

      <div className="mt-8 grid items-start gap-6 lg:-mx-48 lg:grid-cols-2">
        <fieldset>
          <CallRegular promptIndex={promptIndex} start={start} showCode={showCode} />
        </fieldset>

        <fieldset>
          <CallWorkflow promptIndex={promptIndex} start={start} showCode={showCode} />
        </fieldset>
      </div>
    </main>
  )
}
