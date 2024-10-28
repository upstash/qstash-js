export type EmailProviderReturnType = {
  owner: "resend";
  baseUrl: "https://api.resend.com/emails" | "https://api.resend.com/emails/batch";
  token: string;
};

export const resend = ({
  token,
  batch = false,
}: {
  token: string;
  batch?: boolean;
}): EmailProviderReturnType => {
  return {
    owner: "resend",
    baseUrl: `https://api.resend.com/emails${batch ? "/batch" : ""}`,
    token,
  };
};
