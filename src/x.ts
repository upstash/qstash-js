


import * as jose from "jose"
const key = "sig_3nj4aiyJ2JojDnQ1RRodpYubZAZxAJxNfQcRSKPwVUNbueYk2o"
const signature = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiIiLCJib2R5IjoiNDdERVFwajhIQlNhLV9USW1XLTVKQ2V1UWVSa201Tk1wSldaRzNoU3VGVT0iLCJleHAiOjE2OTMyMjA3OTUsImlhdCI6MTY5MzIyMDQ5NSwiaXNzIjoiVXBzdGFzaCIsImp0aSI6Imp3dF80Ym10N3pjUzYyUURMcThCeHJ3UXlMQ0R5TVZnIiwibmJmIjoxNjkzMjIwNDk1LCJzdWIiOiJodHRwczovL3NpZy5yZXF1ZXN0Y2F0Y2hlci5jb20vdGVzdCJ9.O33rr8T5-Q7XJ3yBxQkEFDVPJh6z5JkDGsGHVgX7H_Q"

async function main(){



    console.log(jose.decodeJwt(signature))
    const jwt = await jose
    .jwtVerify(signature, new TextEncoder().encode(key), {
      issuer: "Upstash",
      algorithms: ["HS256"]
    }).catch(err=>{
        if (err instanceof jose.errors.JWSSignatureVerificationFailed){
            console.error(err.message)
        }
        throw err
    })


    console.log(jwt)

}

main()