import { Request, Response, NextFunction } from "express";
import { auth, db } from "../config/firebase";
import { UserRole, UserStatus } from "../models/user.model";

export type AuthenticatedRequest<
  Params = Record<string, string>,
  ReqBody = any
> = Request<Params, any, ReqBody> & {
  user?: {
    uid: string;
    email?: string;
    name?: string;
    role?: UserRole;
    status?: UserStatus;
    hasAdminToken: boolean;
    hasRoleClaim: boolean;
  };
};

type CachedUserData = {
  role?: UserRole;
  status?: UserStatus;
  bannedUntil?: FirebaseFirestore.Timestamp | Date | null;
};

// authMiddleware corre em quase todos os pedidos, e antes lia o documento do
// utilizador no Firestore de cada vez só para saber role/status — sob carga
// (ex.: várias dezenas de utilizadores em simultâneo) isto multiplicava as
// leituras ao Firestore pelo número de pedidos, e qualquer lentidão/erro aí
// era reportado como "token inválido" (401), escondendo a causa real.
// Esta cache curta evita a leitura repetida; USER_CACHE_TTL_MS equilibra
// custo de leitura vs. atraso a refletir mudanças de role/ban feitas pelo
// admin (por isso updateUserRole/updateUserStatus chamam invalidateUserAuthCache).
const USER_CACHE_TTL_MS = 30_000;
const userCache = new Map<string, { data: CachedUserData | undefined; expiresAt: number }>();

export function invalidateUserAuthCache(uid: string): void {
  userCache.delete(uid);
}

async function getCachedUserData(uid: string): Promise<CachedUserData | undefined> {
  const cached = userCache.get(uid);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const userDoc = await db.collection("users").doc(uid).get();
  const data = userDoc.exists ? (userDoc.data() as CachedUserData) : undefined;
  userCache.set(uid, { data, expiresAt: Date.now() + USER_CACHE_TTL_MS });
  return data;
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Missing or invalid Authorization header",
    });
  }

  const token = authHeader.split("Bearer ")[1];

  let decodedToken;
  try {
    decodedToken = await auth.verifyIdToken(token);
  } catch {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }

  try {
    const roleClaim =
      typeof decodedToken.role === "string" ? decodedToken.role : undefined;
    const userTypeClaim =
      typeof decodedToken.userType === "string"
        ? decodedToken.userType
        : undefined;
    const hasRoleClaim =
      roleClaim !== undefined ||
      userTypeClaim !== undefined ||
      typeof decodedToken.admin === "boolean";
    const hasAdminToken =
      decodedToken.admin === true ||
      roleClaim === "admin" ||
      userTypeClaim === "admin";

    let userData = await getCachedUserData(decodedToken.uid);

    // Suspensões temporárias expiram sozinhas: se o prazo já passou,
    // reativa a conta em vez de continuar a bloquear o acesso.
    if (userData?.status === "banned" && userData.bannedUntil) {
      const raw = userData.bannedUntil as any;
      const bannedUntil = raw?.toDate ? raw.toDate() : (raw as Date);
      if (bannedUntil <= new Date()) {
        await db.collection("users").doc(decodedToken.uid).update({
          status: "active",
          bannedUntil: null,
          updatedAt: new Date(),
        });
        userData = { ...userData, status: "active", bannedUntil: null };
        userCache.set(decodedToken.uid, { data: userData, expiresAt: Date.now() + USER_CACHE_TTL_MS });
      }
    }

    if (userData?.status === "banned" || userData?.status === "deleted") {
      return res.status(403).json({
        message: "This account is no longer allowed to access the app",
      });
    }

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      role: userData?.role,
      status: userData?.status,
      hasAdminToken,
      hasRoleClaim,
    };

    next();
  } catch (error) {
    // O token já foi validado com sucesso — se algo falhar daqui para a
    // frente é um problema nosso (ex.: Firestore em baixo/lento), não do
    // pedido do cliente, por isso é um 500 e não um 401.
    res.status(500).json({
      message: error instanceof Error ? error.message : "Error resolving authenticated user",
    });
  }
}
