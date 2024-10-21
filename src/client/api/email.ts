export type EmailProviderReturnType = {
  owner: "resend";
  baseUrl: "https://api.resend.com/emails";
  token: string;
};

export const resend = ({ token }: { token: string }): EmailProviderReturnType => {
  return {
    owner: "resend",
    baseUrl: "https://api.resend.com/emails",
    token,
  };
};
