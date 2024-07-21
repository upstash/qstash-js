
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
    const x = Math.random()
    const invoice = context.requestPayload
    
    for (let index = 0; index < 3; index ++) {
      const charge = await context.run("attemptCharge", async () => {
        const success = attemptCharge(invoice)
        const charge: Charge = {invoice, success}
        return charge
      })
      

      if (charge.success) {
        console.log("success");
        
        const [updateDb, receipt] = await Promise.all([
          context.run("updateDb", async () => {
            console.log(x, "  update db amount", charge.invoice.amount);
            return charge.invoice.amount
          }),
          context.run("sendReceipt", async () => {
            console.log(x, "  send receipt", charge.invoice.email);
            return charge.invoice.email
          })
        ])
        console.log("end", updateDb, receipt);
        return
      }
      await context.sleep("retrySleep", 2)
    }
    await context.run("paymentFailed", async () => {
      console.log(`northStarSimple field permenantly with input ${JSON.stringify(context.requestPayload)}`);
      return true
    })
  }
})


