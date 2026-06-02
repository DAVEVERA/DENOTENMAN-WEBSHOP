import { sendOrderConfirmationJob } from "../jobs/send-order-confirmation";
import { sendShippingConfirmationJob } from "../jobs/send-shipping-confirmation";

export const emailQueue = {
  name: "email",
  jobs: [sendOrderConfirmationJob, sendShippingConfirmationJob],
};
