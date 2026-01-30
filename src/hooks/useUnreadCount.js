import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Hook to get the total unread message count for the current user.
 * Listens to users/{userId}/prefs/unread in real-time.
 */
export function useUnreadCount(userId) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    const unreadRef = doc(db, 'users', userId, 'prefs', 'unread');
    const unsubscribe = onSnapshot(
      unreadRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setUnreadCount(0);
          return;
        }
        const data = snapshot.data();
        const total = Object.values(data).reduce((sum, count) => sum + (typeof count === 'number' ? count : 0), 0);
        setUnreadCount(total);
      },
      (error) => {
        console.error('[useUnreadCount] Error:', error);
        setUnreadCount(0);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return unreadCount;
}
