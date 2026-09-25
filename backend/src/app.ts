// src/app.ts

import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import usersRoutes from "./routes/users.routes";
import activitiesRoutes from "./routes/activities.route";
import sportsRoutes from "./routes/sports.routes";
import messagesRoutes from "./routes/messages.route";
import notificationsRoutes from "./routes/notifications.route";
import friendsRoutes from "./routes/friends.route";
import conversationsRoutes from "./routes/conversations.route";
import badgesRoutes from "./routes/badges.route";

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Muitos utilizadores podem partilhar o mesmo IP público (wifi de campus,
// rede móvel com CGNAT, etc.). Limitar só por IP faz com que um utilizador
// muito ativo esgote a quota de todos os outros nessa rede. Como todas as
// rotas exigem autenticação, particionamos por utilizador (extraído do
// token, sem validar a assinatura — a validação real acontece no
// authMiddleware) e só caímos para o IP quando não há token.
function rateLimitKey(req: Request): string {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const payload = token?.split(".")[1];

  if (payload) {
    try {
      const decoded = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
      const uid = decoded.user_id ?? decoded.sub;
      if (typeof uid === "string" && uid) return `uid:${uid}`;
    } catch {
      // token malformado — cai para o IP abaixo
    }
  }

  return ipKeyGenerator(req.ip ?? "");
}

app.use(
  "/api",
  rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: rateLimitKey,
    message: { message: "Demasiados pedidos. Tenta novamente dentro de momentos." },
  })
);

app.get("/", (req, res) => {
  res.json({
    message: "SportBuddy API is running",
  });
});

app.use("/api/users", usersRoutes);
app.use("/api/activities", activitiesRoutes);
app.use("/api/sports", sportsRoutes);
app.use("/api/activities/:activityId/messages", messagesRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/friends", friendsRoutes);
app.use("/api/conversations", conversationsRoutes);
app.use("/api/badges", badgesRoutes);

app.use((req: Request, res: Response) => {
  res.status(404).json({ message: "Not found" });
});

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  console.error(err);
  res.status(400).json({ message: "Invalid request" });
});

export default app;
