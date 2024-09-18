'use client';

import { useState } from 'react';
import RegularCall from './components/regular-call';
import WorkflowCall from './components/workflow-call';

export default function Page() {
  // Main state to control the button and components
  const [state, setState] = useState(0);

  // Handle button click
  const handleClick = () => {
    setState(2); // Set state to 2 on click
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* The two components */}
      <RegularCall state={state} setState={setState} />
      <WorkflowCall state={state} setState={setState} />

      {/* Button at the bottom */}
      <button
        onClick={handleClick}
        disabled={state !== 0} // Disable the button when state is not 0
        className={`px-4 py-2 rounded bg-blue-500 text-white ${state !== 0 ? 'opacity-50' : ''}`}
      >
        Start Async Tasks
      </button>
    </div>
  );
}
