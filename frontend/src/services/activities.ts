import { api } from '@/services/api';
import { Activity, CreateActivityInput, FeedItem, SkillLevel } from '@/types/activity';

// Sem `date`: a data não é editável depois da atividade ser criada.
export type UpdateActivityInput = {
  title?: string;
  description?: string;
  maxParticipants?: number;
  difficultyLevel?: SkillLevel;
  requiresApproval?: boolean;
};

export type ListActivitiesFilters = {
  createdBy?: string;
  verifiedOnly?: boolean;
  status?: Activity['status'];
};

export function listActivities(filters: ListActivitiesFilters = {}): Promise<Activity[]> {
  const params = new URLSearchParams();
  if (filters.createdBy) params.set('createdBy', filters.createdBy);
  if (filters.verifiedOnly) params.set('verifiedOnly', 'true');
  if (filters.status) params.set('status', filters.status);
  const query = params.toString();
  return api.get<Activity[]>(`/api/activities${query ? `?${query}` : ''}`);
}

export function rateActivity(activityId: string, rating: number): Promise<{ message: string }> {
  return api.post<{ message: string }>(`/api/activities/${activityId}/rate`, { rating });
}

export function getMyActivities(): Promise<Activity[]> {
  return api.get<Activity[]>('/api/activities/me');
}

export function getUserActivities(userId: string): Promise<Activity[]> {
  return api.get<Activity[]>(`/api/activities/user/${userId}`);
}

export function getFriendsFeed(): Promise<FeedItem[]> {
  return api.get<FeedItem[]>('/api/activities/friends/feed');
}

export function getFriendsActivities(): Promise<Activity[]> {
  return api.get<Activity[]>('/api/activities/friends');
}

export function getActivity(activityId: string): Promise<Activity> {
  return api.get<Activity>(`/api/activities/${activityId}`);
}

export function createActivity(data: CreateActivityInput): Promise<Activity> {
  return api.post<Activity>('/api/activities', data);
}

export function updateActivity(activityId: string, data: UpdateActivityInput): Promise<Activity> {
  return api.patch<Activity>(`/api/activities/${activityId}`, data);
}

export function listAdminActivities(): Promise<Activity[]> {
  return api.get<Activity[]>('/api/activities/admin/all');
}

export function deleteActivityAsAdmin(activityId: string): Promise<{ message: string }> {
  return api.delete<{ message: string }>(`/api/activities/${activityId}/admin`);
}

export function joinActivity(activityId: string): Promise<Activity> {
  return api.post<Activity>(`/api/activities/${activityId}/join`);
}

export function leaveActivity(activityId: string): Promise<Activity> {
  return api.post<Activity>(`/api/activities/${activityId}/leave`);
}

export function cancelActivity(activityId: string): Promise<Activity> {
  return api.patch<Activity>(`/api/activities/${activityId}/cancel`);
}

export function removeParticipant(activityId: string, participantId: string): Promise<Activity> {
  return api.patch<Activity>(`/api/activities/${activityId}/remove-participant`, { participantId });
}

export function admitFromWaitlist(activityId: string, userId: string): Promise<Activity> {
  return api.patch<Activity>(`/api/activities/${activityId}/admit-from-waitlist`, { userId });
}

export function rejectFromWaitlist(activityId: string, userId: string): Promise<Activity> {
  return api.patch<Activity>(`/api/activities/${activityId}/reject-from-waitlist`, { userId });
}

// Regista o voto de MVP do utilizador atual num participante da atividade.
// O backend só devolve uma mensagem de sucesso, por isso quem chama deve
// recarregar a atividade a seguir para ver os votos/vencedores atualizados.
export function voteMvp(activityId: string, votedForId: string): Promise<{ message: string }> {
  return api.post<{ message: string }>(`/api/activities/${activityId}/vote-mvp`, { votedForId });
}

  export type NearbyActivitiesFilters = {
    lat: number;
    lng: number;
    radiusKm: number;
    sportId?: string;
    difficultyLevel?: string;
    verifiedOnly?: boolean;
  };

  export function listNearbyActivities(
    filters: NearbyActivitiesFilters
  ): Promise<Activity[]> {
    const params = new URLSearchParams({
      lat: String(filters.lat),
      lng: String(filters.lng),
      radiusKm: String(filters.radiusKm),
    });

    if (filters.sportId) {
      params.set('sportId', filters.sportId);
    }

    if (filters.difficultyLevel) {
      params.set('difficultyLevel', filters.difficultyLevel);
    }

    if (filters.verifiedOnly) {
      params.set('verifiedOnly', 'true');
    }

    return api.get<Activity[]>(`/api/activities?${params.toString()}`);
  }
