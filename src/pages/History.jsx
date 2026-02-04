import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import Navbar from '../components/Navbar';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';

const History = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rideHistory, setRideHistory] = useState([]);
  const [acceptedHistory, setAcceptedHistory] = useState([]);
  const [error, setError] = useState('');
  const [requestsError, setRequestsError] = useState('');
  const [matchesError, setMatchesError] = useState('');

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError('');
      setRequestsError('');
      setMatchesError('');

      // Load ride requests
      let requests = [];
      try {
        const requestsQ = query(
          collection(db, 'ride_requests'),
          where('userId', '==', currentUser.uid)
        );
        const requestsSnap = await getDocs(requestsQ);
        requests = requestsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        console.log(`[History] Loaded ${requests.length} ride requests`);
      } catch (e) {
        console.error('[History] Error loading ride requests:', e);
        const errorMsg = e.message || 'Unknown error';
        setRequestsError(`Failed to load ride requests: ${errorMsg}`);
        console.error('[History] Full error details:', {
          code: e.code,
          message: e.message,
          stack: e.stack
        });
      }

      // Load matches - try both queries separately to handle permissions better
      let matches = [];
      try {
        // Query for matches where user is userA
        try {
          const matchesQ1 = query(
            collection(db, 'matches'),
            where('userA', '==', currentUser.uid)
          );
          const mSnap1 = await getDocs(matchesQ1);
          matches.push(...mSnap1.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        } catch (e1) {
          console.warn('[History] Error loading matches as userA:', e1);
        }

        // Query for matches where user is userB
        try {
          const matchesQ2 = query(
            collection(db, 'matches'),
            where('userB', '==', currentUser.uid)
          );
          const mSnap2 = await getDocs(matchesQ2);
          matches.push(...mSnap2.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        } catch (e2) {
          console.warn('[History] Error loading matches as userB:', e2);
        }

        // Remove duplicates (in case a match somehow has user as both A and B)
        const uniqueMatches = matches.filter((match, index, self) =>
          index === self.findIndex((m) => m.id === match.id)
        );
        matches = uniqueMatches;
        console.log(`[History] Loaded ${matches.length} matches`);
      } catch (e) {
        console.error('[History] Error loading matches:', e);
        const errorMsg = e.message || 'Unknown error';
        setMatchesError(`Failed to load matches: ${errorMsg}`);
        console.error('[History] Full error details:', {
          code: e.code,
          message: e.message,
          stack: e.stack
        });
      }

      setRideHistory(requests);
      setAcceptedHistory(matches);
      setLoading(false);
    };

    load();
  }, [currentUser]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
        <Navbar />
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <h1 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent mb-6">
            History & Safety Log
          </h1>
          <p className="text-sm sm:text-base text-dark-600 mb-6">
            For your safety, we keep a private record of rides you created and matches you&apos;ve been part of.
          </p>

          {error && (
            <div className="mb-4 bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm sm:text-base">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-dark-600 text-sm sm:text-base">Loading history…</p>
          ) : (
            <div className="space-y-10">
              <section>
                <h2 className="text-xl sm:text-2xl font-bold text-dark-900 mb-4">Ride requests you created</h2>
                {requestsError && (
                  <div className="mb-4 bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm sm:text-base">
                    {requestsError}
                  </div>
                )}
                {rideHistory.length === 0 && !requestsError ? (
                  <p className="text-sm sm:text-base text-dark-600">No ride requests found.</p>
                ) : rideHistory.length > 0 ? (
                  <div className="space-y-3">
                    {rideHistory.map((r) => (
                      <div
                        key={r.id}
                        className="bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200 shadow-sm p-4 text-sm sm:text-base"
                      >
                        <div className="flex flex-wrap gap-2 justify-between items-center mb-2">
                          <span className="font-semibold text-dark-900">
                            {r.pickupText || 'Unknown pickup'} → {r.dropText || 'Unknown drop'}
                          </span>
                          <span className="text-xs sm:text-sm px-2 py-1 rounded-full bg-slate-100 text-dark-700 font-medium">
                            {r.status || 'unknown'}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-dark-600">
                          Time window:{' '}
                          {r.timeStart ? new Date(r.timeStart).toLocaleString() : 'N/A'}{' '}
                          {r.timeEnd ? `- ${new Date(r.timeEnd).toLocaleString()}` : ''}
                        </p>
                        {r.createdAt && (
                          <p className="text-xs text-dark-400 mt-1">
                            Created at {new Date(r.createdAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h2 className="text-xl sm:text-2xl font-bold text-dark-900 mb-4">Requests you accepted / matches</h2>
                {matchesError && (
                  <div className="mb-4 bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm sm:text-base">
                    {matchesError}
                  </div>
                )}
                {acceptedHistory.length === 0 && !matchesError ? (
                  <p className="text-sm sm:text-base text-dark-600">No accepted matches found.</p>
                ) : acceptedHistory.length > 0 ? (
                  <div className="space-y-3">
                    {acceptedHistory.map((m) => (
                      <div
                        key={m.id}
                        className="bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200 shadow-sm p-4 text-sm sm:text-base"
                      >
                        <div className="flex flex-wrap gap-2 justify-between items-center mb-2">
                          <span className="font-semibold text-dark-900">
                            Match ID: {m.id}
                          </span>
                          <span className="text-xs sm:text-sm px-2 py-1 rounded-full bg-green-50 text-green-700 font-medium">
                            Active match
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-dark-600">
                          You were matched with another rider for a shared ride.
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
};

export default History;

