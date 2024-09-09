const { Client, Receiver } = require("@upstash/qstash");
require("isomorphic-fetch");

async function main() {
  const q = new Client({
    token: "",
  });

  const res = await q.publish({
    url: "https://qstash-prod-andreas.requestcatcher.com/test",
    body: "Hello World",
  });
  console.log(res);

  // Validating a signature
  const receiver = new Receiver({
    currentSigningKey: "sig_3nj4aiyJ2JojDnQ1RRodpYubZAZxAJxNfQcRSKPwVUNbueYk2o",
    nextSigningKey: "sig_31zVqmL3s7Eo1vpu1jRSMpaetJXvAT3RvNcfoGUp1Toii8fsQE",
  });

  const isValid = await receiver
    .verify({
      signature:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiIiLCJib2R5IjoicFpHbTFBdjBJRUJLQVJjeno3ZXhrTllzWmI4THphTXJWN0ozMmEyZkZHND0iLCJleHAiOjE2NTc1MzA3NTYsImlhdCI6MTY1NzUzMDQ1NiwiaXNzIjoiVXBzdGFzaCIsImp0aSI6Imp3dF83QXFHbkRLV3dLTmY2dEdUNExnRjhqdENEQjhqIiwibmJmIjoxNjU3NTMwNDU2LCJzdWIiOiJodHRwczovL3FzdGFzaC1wcm9kLWFuZHJlYXMucmVxdWVzdGNhdGNoZXIuY29tL3Rlc3QifQ.GzDXaBRUAqx0KPE-WxfZVVceJll3T1RgxdTRbWPZw8s",
      body: "Hello World",
      url: "https://qstash-prod-andreas.requestcatcher.com/test",
    })
    .catch((err) => {
      console.log(err);
      return false;
    });

  console.log({ isValid });
}

main();
