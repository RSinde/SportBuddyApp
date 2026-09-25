export type NotificationType =
  | 'activity_joined'
  | 'activity_join_request'
  | 'activity_left'
  | 'activity_full'
  | 'waitlist_admitted'
  | 'participant_removed'
  | 'activity_cancelled'
  | 'activity_reminder'
  | 'activity_auto_cancelled'
  | 'new_message'
  | 'mvp_voting_open'
  | 'mvp_result'
  | 'friend_request'
  | 'friend_request_accepted'
  | 'badge_earned'
  | 'new_activity_from_followed'
  | 'activity_rating_open';

export type Notification = {
  id: string;
  userId: string;
  type: NotificationType;
  // Legacy pre-i18n notifications carry a pre-rendered PT message instead of a key.
  message?: string;
  messageKey?: string;
  messageParams?: Record<string, string | number>;
  activityId?: string;
  relatedUserId?: string;
  read: boolean;
  createdAt: string;
};
