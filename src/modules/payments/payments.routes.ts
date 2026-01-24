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
router.post("/checkout/create", requireWhopContext, requireWhopAccess, CheckoutController.createCheckout);

// ✅ Verify payment after checkout (without webhooks)
router.post("/checkout/verify", requireWhopContext, requireWhopAccess, CheckoutController.verifyPayment);

export default router;
