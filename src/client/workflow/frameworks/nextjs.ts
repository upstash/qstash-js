import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { WorkflowServeParameters } from "../types";
import { serve as serveBase } from "../serve";

export const serve = <TPayload>({
  routeFunction,
  options,
}: WorkflowServeParameters<TPayload, NextResponse>): ((
  request: NextRequest
) => Promise<NextResponse>) => {
  return serveBase<TPayload, NextRequest, NextResponse>({
    routeFunction,
    options: {
      onFinish: (workflowId: string) =>
        new NextResponse(JSON.stringify({ workflowId }), { status: 200 }),
      ...options,
    },
  });
};
