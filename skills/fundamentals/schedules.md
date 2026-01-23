# Schedules

Schedule recurring messages using cron expressions.

## Creating Schedules

```typescript
import { Client } from "@upstash/qstash";

const client = new Client({ token: process.env.QSTASH_TOKEN! });

const result = await client.schedules().create({
  destination: "https://api.example.com/daily-report",
  cron: "0 9 * * *", // Daily at 9 AM UTC
  body: JSON.stringify({ report: "daily" }),
  headers: { "Content-Type": "application/json" },
});

console.log(result.scheduleId);
```

- `destination`: URL or URL group name
- `cron`: Cron expression (required)
- `body`: Message payload
- All publish options supported (retries, timeout, callback, etc.)

## Common Cron Patterns

```
0 * * * *        Every hour
0 9 * * *        Daily at 9 AM UTC
0 9 * * 1        Weekly on Monday at 9 AM
0 9 1 * *        Monthly on 1st at 9 AM
*/15 * * * *     Every 15 minutes
0 9-17 * * 1-5   Weekdays, 9 AM to 5 PM, hourly
0 0 1 1 *        Annually on January 1st
```

Format: `minute hour day month weekday`

- Minute: 0-59
- Hour: 0-23 (UTC)
- Day: 1-31
- Month: 1-12
- Weekday: 0-6 (Sunday=0)

## Managing Schedules

### List All Schedules

```typescript
const schedules = await client.schedules().list();

schedules.forEach((s) => {
  console.log(`${s.scheduleId}: ${s.cron} -> ${s.destination}`);
  console.log(`  Next run: ${new Date(s.nextScheduleTime!)}`);
  console.log(`  Paused: ${s.isPaused}`);
});
```

### Get Schedule Details

```typescript
const schedule = await client.schedules().get("scd_123...");

console.log(schedule.cron);
console.log(schedule.destination);
console.log(schedule.retries);
console.log(schedule.body); // Base64 encoded
```

### Delete Schedule

```typescript
await client.schedules().delete("scd_123...");
```

### Pause and Resume

```typescript
// Pause - stops scheduling new messages
await client.schedules().pause({ scheduleId: "scd_123..." });

// Resume - restarts scheduling
await client.schedules().resume({ scheduleId: "scd_123..." });
```

In-flight messages continue when paused.

## Schedule with Options

```typescript
await client.schedules().create({
  destination: "https://api.example.com/cleanup",
  cron: "0 2 * * *", // Daily at 2 AM
  body: JSON.stringify({ task: "cleanup" }),
  headers: { "Content-Type": "application/json" },
  retries: 3,
  timeout: 120,
  callback: "https://api.example.com/schedule-callback",
  failureCallback: "https://api.example.com/schedule-failure",
  label: "nightly-cleanup",
});
```

## Schedule to URL Group

```typescript
await client.schedules().create({
  destination: "status-checkers", // URL group name
  cron: "*/5 * * * *", // Every 5 minutes
  body: JSON.stringify({ check: "health" }),
});
```

Schedule creates one message per endpoint in the group on each trigger.

## Schedule to Queue

```typescript
await client.schedules().create({
  destination: "https://api.example.com/process",
  cron: "0 * * * *",
  queueName: "hourly-tasks",
  body: JSON.stringify({ task: "process" }),
});
```

Messages are enqueued for ordered FIFO delivery. See [Queues](queues-and-flow-control.md).

## Updating Schedules

To update, provide the existing `scheduleId`:

```typescript
await client.schedules().create({
  scheduleId: "scd_123...", // Existing schedule ID
  destination: "https://api.example.com/updated-endpoint",
  cron: "0 10 * * *", // New time
  body: JSON.stringify({ updated: true }),
});
```

All fields are replaced with new values.

## Deduplication

Prevent duplicate schedules:

```typescript
await client.schedules().create({
  destination: "https://api.example.com/daily",
  cron: "0 9 * * *",
  deduplicationId: "daily-report-schedule",
  body: JSON.stringify({ report: "daily" }),
});
```

Deduplication happens before schedule creation. See [Deduplication](../advanced/deduplication.md).

## Schedule Tracking

Schedule metadata includes execution history:

```typescript
const schedule = await client.schedules().get("scd_123...");

console.log(schedule.lastScheduleTime); // Last execution time
console.log(schedule.nextScheduleTime); // Next execution time
console.log(schedule.lastScheduleStates); // Recent message states
```

`lastScheduleStates` maps message IDs to states:

- `IN_PROGRESS`: Currently delivering
- `SUCCESS`: Successfully delivered
- `FAIL`: Failed after retries
