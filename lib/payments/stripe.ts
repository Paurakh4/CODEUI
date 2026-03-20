import Stripe from 'stripe';
import { getStripeServerConfigIssues } from './stripe-config';

let stripeInstance: Stripe | null = null;

export function getStripeServer(): Stripe {
  if (stripeInstance) {
    return stripeInstance;
  }

  const [configIssue] = getStripeServerConfigIssues();

  if (configIssue) {
    throw new Error(configIssue);
  }

  stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-12-15.clover' as any,
    appInfo: {
      name: 'CodeUI',
      version: '0.1.0',
    },
  });

  return stripeInstance;
}
