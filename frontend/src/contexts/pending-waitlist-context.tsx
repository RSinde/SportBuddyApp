import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/contexts/auth-context';
import { getMyActivities } from '@/services/activities';

type PendingWaitlistContextValue = {
  pendingCount: number;
  refresh: () => void;
};

const PendingWaitlistContext = createContext<PendingWaitlistContextValue | undefined>(undefined);

export function PendingWaitlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  const refresh = useCallback(() => {
    if (!user) { setPendingCount(0); return; }
    getMyActivities()
      .then((activities) => {
        const count = activities.filter(
          (a) => a.createdBy === user.uid && a.waitlist.length > 0
        ).length;
        setPendingCount(count);
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    queueMicrotask(refresh);
  }, [refresh]);

  return (
    <PendingWaitlistContext.Provider value={{ pendingCount, refresh }}>
      {children}
    </PendingWaitlistContext.Provider>
  );
}

export function usePendingWaitlist() {
  const context = useContext(PendingWaitlistContext);
  if (!context) {
    throw new Error('usePendingWaitlist must be used within a PendingWaitlistProvider');
  }
  return context;
}
