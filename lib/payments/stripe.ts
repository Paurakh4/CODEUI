import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover' as any, // Use the latest API version or bypass version check if needed
  appInfo: {
    name: 'CodeUI',
    version: '0.1.0',
  },
});
