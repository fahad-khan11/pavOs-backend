import { Router } from "express";

import { MembersController } from "./members.controller";
import { requireWhopContext } from "@/middlewares/requireWhopContext";
import { requireWhopAccess } from "@/middlewares/requireWhopAccess";

const router = Router();

router.get("/", requireWhopContext, requireWhopAccess, MembersController.list);
router.get("/:id", requireWhopContext, requireWhopAccess, MembersController.retrieve);

export default router;
