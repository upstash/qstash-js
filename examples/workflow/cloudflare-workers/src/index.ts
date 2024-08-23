
import app from "./app";

export type Env = {
  QSTASH_URL: string;
  QSTASH_TOKEN: string;
  QSTASH_CURRENT_SIGNING_KEY: string;
  QSTASH_NEXT_SIGNING_KEY: string;
};

export default {
  async fetch(request: Request, environment: Env, context: ExecutionContext): Promise<Response> {
    return app.fetch(request, environment, context);
  },
};
