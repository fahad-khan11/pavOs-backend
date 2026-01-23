import { requireWhopAccess } from "@/middlewares/requireWhopAccess";
import { requireWhopContext } from "@/middlewares/requireWhopContext";
import { Router } from "express";
import { PaymentsController } from "./payments.controller";



const router = Router();

router.get("/", requireWhopContext, requireWhopAccess, PaymentsController.list);
// ✅ Retrieve single payment
router.get("/:id", requireWhopContext, requireWhopAccess, PaymentsController.retrieve);

export default router;
