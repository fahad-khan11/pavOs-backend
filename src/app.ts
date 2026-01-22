import express from "express";
import cors from "cors";
import morgan from "morgan";
import membersRoutes from "./modules/members/members.routes";
import { errorHandler } from "./middlewares/errorHandler";


export const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/v1/members", membersRoutes);

app.use(errorHandler);
