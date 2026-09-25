import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { friendsService } from "../services/friends.service";
import { usersService } from "../services/users.service";

export async function cancelFriendRequest(
  req: AuthenticatedRequest<{ addresseeId: string }>,
  res: Response
): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ message: "Unauthorized" }); return; }
    const { addresseeId } = req.params;
    await friendsService.cancelRequest(req.user.uid, addresseeId);
    res.status(200).json({ message: "Pedido cancelado" });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Erro ao cancelar pedido" });
  }
}

export async function removeFriend(
  req: AuthenticatedRequest<{ friendId: string }>,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const user = await usersService.getUserByFirebaseUid(req.user.uid);
    if (!user) {
      res.status(404).json({ message: "User profile not found" });
      return;
    }

    await friendsService.removeFriend(user.id, req.params.friendId);
    res.status(200).json({ message: "Amigo removido" });
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Erro ao remover amigo",
    });
  }
}

export async function getFriends(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const user = await usersService.getUserByFirebaseUid(req.user.uid);
    if (!user) {
      res.status(404).json({ message: "User profile not found" });
      return;
    }

    const friends = await friendsService.getFriends(user.id);
    res.status(200).json(friends);
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : "Erro ao obter amigos",
    });
  }
}

export async function getPendingRequests(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const user = await usersService.getUserByFirebaseUid(req.user.uid);
    if (!user) {
      res.status(404).json({ message: "User profile not found" });
      return;
    }

    const requests = await friendsService.getPendingRequests(user.id);
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : "Erro ao obter pedidos de amizade",
    });
  }
}

export async function rejectFriendRequest(
  req: AuthenticatedRequest<{ requestId: string }>,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const user = await usersService.getUserByFirebaseUid(req.user.uid);
    if (!user) {
      res.status(404).json({ message: "User profile not found" });
      return;
    }

    await friendsService.rejectRequest(req.params.requestId, user.id);
    res.status(200).json({ message: "Pedido rejeitado" });
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Erro ao rejeitar pedido",
    });
  }
}

export async function acceptFriendRequest(
  req: AuthenticatedRequest<{ requestId: string }>,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const user = await usersService.getUserByFirebaseUid(req.user.uid);
    if (!user) {
      res.status(404).json({ message: "User profile not found" });
      return;
    }

    await friendsService.acceptRequest(req.params.requestId, user.id);
    res.status(200).json({ message: "Pedido aceite" });
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Erro ao aceitar pedido",
    });
  }
}

export async function sendFriendRequest(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const { addresseeId } = req.body;
    if (!addresseeId) {
      res.status(400).json({ message: "addresseeId is required" });
      return;
    }

    const requester = await usersService.getUserByFirebaseUid(req.user.uid);
    if (!requester) {
      res.status(404).json({ message: "User profile not found" });
      return;
    }

    await friendsService.sendRequest(requester.id, addresseeId);
    res.status(201).json({ message: "Pedido de amizade enviado" });
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Erro ao enviar pedido de amizade",
    });
  }
}
