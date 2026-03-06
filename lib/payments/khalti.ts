import { SubscriptionTier } from "../pricing";

export const KHALTI_API_URL = "https://a.khalti.com/api/v2";
// For production, it should be https://khalti.com/api/v2 (or a.khalti.com is also live?)
// Docs say: 
// Sandbox: https://a.khalti.com/api/v2/
// Production: https://khalti.com/api/v2/
// Wait, user provided docs say:
// "User is redirected to the epayment portal (eg. https://pay.khalti.com)"
// "API Endpoints ... https://dev.khalti.com/api/v2/epayment/initiate/"
// Let's use an env var for the base URL or default to dev for now.

export const getKhaltiBaseUrl = () => {
  return process.env.KHALTI_BASE_URL || "https://a.khalti.com/api/v2";
};

// Price mapping in Paisa (1 NPR = 100 Paisa)
export const KHALTI_PRICES: Record<string, number> = {
  // Subscription Tiers
  "pro": 130000,      // NPR 1300
  "proplus": 400000,  // NPR 4000
  
  // Topup Packages
  "topup_25": 60000,  // NPR 600
  "topup_50": 120000, // NPR 1200
  "topup_100": 250000 // NPR 2500
};

export const KHALTI_PLAN_NAMES: Record<string, string> = {
  "pro": "Pro Plan Subscription",
  "proplus": "Pro Plus Plan Subscription",
  "topup_25": "25 Credits Topup",
  "topup_50": "50 Credits Topup",
  "topup_100": "100 Credits Topup"
};

export interface KhaltiInitiatePayload {
  return_url: string;
  website_url: string;
  amount: number;
  purchase_order_id: string;
  purchase_order_name: string;
  customer_info?: {
    name: string;
    email: string;
    phone: string;
  };
  merchant_username?: string;
  merchant_extra?: string;
}

export interface KhaltiInitiateResponse {
  pidx: string;
  payment_url: string;
  expires_at: string;
  expires_in: number;
  user_fee: number;
}

export interface KhaltiLookupResponse {
  pidx: string;
  total_amount: number;
  status: "Completed" | "Pending" | "Initiated" | "Refunded" | "Expired" | "User canceled";
  transaction_id: string;
  fee: number;
  refunded: boolean;
}

export async function initiateKhaltiPayment(payload: KhaltiInitiatePayload) {
  const response = await fetch(`${getKhaltiBaseUrl()}/epayment/initiate/`, {
    method: "POST",
    headers: {
      "Authorization": `Key ${process.env.KHALTI_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Khalti Initiate Failed: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<KhaltiInitiateResponse>;
}

export async function verifyKhaltiPayment(pidx: string) {
  const response = await fetch(`${getKhaltiBaseUrl()}/epayment/lookup/`, {
    method: "POST",
    headers: {
      "Authorization": `Key ${process.env.KHALTI_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ pidx }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Khalti Verification Failed: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<KhaltiLookupResponse>;
}
