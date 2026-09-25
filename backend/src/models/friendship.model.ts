export type FriendRequest = {
  id: string;
  requesterId: string;
  addresseeId: string;
  createdAt: Date;
};

export type FriendUserDto = {
  id: string;
  name: string;
  avatarUrl?: string;
};

export type FriendDto = {
  userId: string;
  user: FriendUserDto;
};

export type FriendRequestDto = {
  requestId: string;
  from: FriendUserDto;
  createdAt: string;
};

export function createFriendRequestObject(
  id: string,
  requesterId: string,
  addresseeId: string
): FriendRequest {
  return { id, requesterId, addresseeId, createdAt: new Date() };
}
