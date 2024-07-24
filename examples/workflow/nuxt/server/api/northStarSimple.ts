
import { serve } from "@upstash/qstash/workflow/nuxt";

const someWork = (input: string) => {
  return `processed '${input}'`
}

type Invoice = {
  date: number,
  email: string,
  amount: number
}

type Charge = {
  invoice: Invoice,
  success: boolean
}

let counter = 0
const attemptCharge = (invoice: Invoice) => {
  counter += 1;
  if (counter  === 3) {
    console.log(" charge success", invoice);
    counter = 0
    return true;
  }
  console.log(" charge failed", invoice);
  return false;
}

export default serve<Invoice>({
  routeFunction: async context => {
    const invoice = context.requestPayload
    
    for (let index = 0; index < 3; index ++) {
      const charge = await context.run("attemptCharge", async () => {
        const success = attemptCharge(invoice)
        const charge: Charge = {invoice, success}
        return charge
      })

      if (charge.success) {
        const updateDb = await context.run("updateDb", async () => {
          console.log("  update db amount", charge.invoice.amount);
          return 5
        })

        await context.run("sendReceipt", async () => {
          console.log("  send receipt", charge.invoice.email, updateDb);
          return 10
        })

        return
      }
      await context.sleep("retrySleep", 2)
    }
    await context.run("paymentFailed", async () => {
      console.log(`northStarSimple failed permenantly with input ${JSON.stringify(context.requestPayload)}`);
      return true
    })
  }
})


