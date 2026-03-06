import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { 
  initiateKhaltiPayment, 
  KHALTI_PRICES, 
  KHALTI_PLAN_NAMES 
} from "@/lib/payments/khalti";

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planId } = await req.json();

    if (!planId) {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });
    }

    const amount = KHALTI_PRICES[planId];
    if (!amount) {
      return NextResponse.json({ error: "Invalid Plan ID" }, { status: 400 });
    }

    const planName = KHALTI_PLAN_NAMES[planId] || "CodeUI Subscription";
    const userId = session.user.id;
    
    // Create a unique purchase order ID
    // Format: userId__planId__timestamp
    const purchaseOrderId = `${userId}__${planId}__${Date.now()}`;

    const payload = {
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/khalti/callback`,
      website_url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      amount, // In paisa
      purchase_order_id: purchaseOrderId,
      purchase_order_name: planName,
      customer_info: {
        name: session.user.name || "CodeUI User",
        email: session.user.email || "",
        phone: "9800000000"
      }
    };

    // If customer_info is optional, we can omit phone if we don't have it.
    // However, let's keep name and email.
    
    const khaltiResponse = await initiateKhaltiPayment(payload);

    return NextResponse.json({ 
      url: khaltiResponse.payment_url,
      pidx: khaltiResponse.pidx
    });
  } catch (err: any) {
    console.error("KHALTI_INITIATE_ERROR", err);
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 });
  }
}
