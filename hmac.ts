import { decode } from "./base64.ts";

export type VerifySignatureRequest = {
  // base64 encoded signature
  signature: string;
  signingKey: string;

  // raw body
  data: Uint8Array;
};
export async function verifySignature(
  req: VerifySignatureRequest,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(req.signingKey),
    {
      name: "HMAC",
      hash: { name: "SHA-256" },
    },
    false,
    ["verify"],
  );

  return await crypto.subtle.verify(
    {
      name: "HMAC",
    },
    key,
    decode(req.signature),
    req.data,
  );
}
