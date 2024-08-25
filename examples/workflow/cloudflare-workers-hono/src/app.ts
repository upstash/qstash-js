import { Hono } from "hono";
import { serve, WorkflowBindings } from "@upstash/qstash/hono"
import { landingPage } from "./page";

const app = new Hono<{ Bindings: WorkflowBindings }>();

app.get("/", (c) => {
  return c.html(landingPage);
});

const someWork = (input: string) => {
  return `processed '${JSON.stringify(input)}'`
}

app.post("/workflow", serve<{text: string}>(
  async context => {
    const input = context.requestPayload.text
    const result1 = await context.run("step1", async () => {
      const output = someWork(input)
      console.log("step 1 input", input, "output", output)
      return output
    });

    const result2 = await context.run("step2", async () => {
      const output = someWork(result1)
      console.log("step 2 input", result1, "output", output)
    });
  },
  {
    receiver: undefined,
  }
))

export default app