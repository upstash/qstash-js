import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { WorkflowServeParameters } from "../types";
import { serve as serveBase } from "../serve";

export const serve = <TInitialPayload>({
  routeFunction,
  options,
}: WorkflowServeParameters<TInitialPayload, NextResponse>): ((
  request: NextRequest
) => Promise<NextResponse>) => {
  return serveBase<TInitialPayload, NextRequest, NextResponse>({
    routeFunction,
    options: {
      onStepFinish: (workflowId: string) =>
        new NextResponse(JSON.stringify({ workflowId }), { status: 200 }),
      ...options,
    },
  });
};
