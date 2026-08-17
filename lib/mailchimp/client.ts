import "server-only";
import mailchimp from "@mailchimp/mailchimp_marketing";
import { getMailchimpEnvironment } from "@/lib/env";

let configured = false;

export function getMailchimpClient(): typeof mailchimp {
  if (!configured) {
    const environment = getMailchimpEnvironment();
    mailchimp.setConfig({
      apiKey: environment.MAILCHIMP_API_KEY,
      server: environment.MAILCHIMP_SERVER_PREFIX,
    });
    configured = true;
  }

  return mailchimp;
}
