import { Hono } from "hono";
import { serve, WorkflowBindings } from "@upstash/qstash/hono"

const app = new Hono<{ Bindings: WorkflowBindings }>();

app.get("/", (c) => {
  const landingPage = `
    <html>
      <body>
        <h1>Available Endpoints</h1>
        <ul>
          <li><a href="/add-data">Add Data</a></li>
          <li><a href="/chat">Chat</a></li>
          <li><a href="/chat-stream">Chat Stream (Upstash)</a></li>
          <li><a href="/chat-stream-openai">Chat Stream (Open AI)</a></li>
        </ul>
      </body>
    </html>
  `;
  return c.html(landingPage);
});

app.post("/workflow", serve<string>(
  async (context) => {
    const result = await context.run("step 1", async () => {
      return "some result" + context.requestPayload
    })

    await context.run("step 2", async ()=> {
      console.log(`${result} in step 2`);
    })
  },
  {
    receiver: undefined,
  }
))

export default app