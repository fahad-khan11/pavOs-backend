import { requireWhopAccess } from "@/middlewares/requireWhopAccess";
import { requireWhopContext } from "@/middlewares/requireWhopContext";
import { Router } from "express";
import { PaymentsController } from "./payments.controller";
import { CheckoutController } from "./checkout.controller";

const router = Router();

// ✅ List all payments
router.get("/", requireWhopContext, requireWhopAccess, PaymentsController.list);

// ✅ Retrieve single payment
router.get("/:id", requireWhopContext, requireWhopAccess, PaymentsController.retrieve);

// ✅ Create checkout configuration (embedded checkout)
// No access check needed - users can purchase even without existing access
router.post("/checkout/create", requireWhopContext, CheckoutController.createCheckout);

// ✅ Verify payment after checkout (without webhooks)
// No access check needed - verifying a payment they just made
router.post("/checkout/verify", requireWhopContext, CheckoutController.verifyPayment);

export default router;
