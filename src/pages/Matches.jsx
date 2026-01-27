import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, doc, addDoc, updateDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase/config';
import Navbar from '../components/Navbar';
import ProtectedRoute from '../components/ProtectedRoute';

const Matches = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [potentialMatches, setPotentialMatches] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [mutualMatches, setMutualMatches] = useState([]);
  const [activeTab, setActiveTab] = useState('potential');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState(null);

  useEffect(() => {
    const requestId = searchParams.get('requestId');
    if (requestId) {
      setSelectedRequestId(requestId);
    }
    fetchPotentialMatches(requestId);
    const unsubscribeMatchRequests = fetchMatchRequests();
    const unsubscribeRealTime = setupRealTimeMatches(); // Set up real-time listener
    
    return () => {
      if (unsubscribeMatchRequests) unsubscribeMatchRequests();
      if (unsubscribeRealTime) unsubscribeRealTime();
    };
  }, [searchParams]);

  // Real-time listener for new matches
  const setupRealTimeMatches = () => {
    if (!currentUser) return null;
    
    // Listen to potential_matches collection for this user
    const potentialMatchesQuery = query(
      collection(db, 'potential_matches'),
      where('userId', '==', currentUser.uid),
      where('status', '==', 'new')
    );

    const unsubscribe = onSnapshot(potentialMatchesQuery, (snapshot) => {
      const newMatches = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (newMatches.length > 0) {
        // Convert potential_matches format to matches format
        const formattedMatches = newMatches.map(match => ({
          userId: match.matchedUserId,
          rideRequestId: match.matchedRideRequestId,
          name: match.matchedUserName,
          gender: match.matchedUserGender,
          age: match.matchedUserAge,
          phone: match.matchedUserPhone,
          photoUrl: match.matchedUserPhotoUrl,
          pickupText: match.pickupText,
          dropText: match.dropText,
          timeStart: match.timeStart,
          timeEnd: match.timeEnd,
          compatibilityScore: match.compatibilityScore,
          distance: match.distance,
          isNew: true // Flag to show it's a new match
        }));

        // Merge with existing matches
        setPotentialMatches(prev => {
          const combined = [...prev, ...formattedMatches];
          // Remove duplicates
          const unique = combined.filter((v, i, a) => 
            a.findIndex(t => t.rideRequestId === v.rideRequestId) === i
          );
          return unique.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
        });

        // Mark as viewed
        newMatches.forEach(match => {
          updateDoc(doc(db, 'potential_matches', match.id), {
            status: 'viewed'
          });
        });
      }
    }, (error) => {
      console.error('Error listening to real-time matches:', error);
    });

    return () => unsubscribe();
  };

  const fetchPotentialMatches = async (specificRequestId = null) => {
    try {
      setLoading(true);
      
      // Get user's active ride requests
      const rideRequestsQuery = query(
        collection(db, 'ride_requests'),
        where('userId', '==', currentUser.uid),
        where('status', '==', 'active')
      );
      const rideRequestsSnapshot = await getDocs(rideRequestsQuery);
      
      if (rideRequestsSnapshot.empty) {
        setError('No active ride requests found. Create a ride request first.');
        setLoading(false);
        return;
      }

      // Use specific request ID if provided, otherwise use the first active request
      let rideRequestId;
      if (specificRequestId) {
        // Verify the request belongs to the user
        const requestDoc = rideRequestsSnapshot.docs.find(doc => doc.id === specificRequestId);
        if (requestDoc) {
          rideRequestId = specificRequestId;
        } else {
          rideRequestId = rideRequestsSnapshot.docs[0].id;
        }
      } else {
        rideRequestId = rideRequestsSnapshot.docs[0].id;
      }

      // Call Cloud Function to find matches
      const findMatches = httpsCallable(functions, 'findMatches');
      const result = await findMatches({ rideRequestId });
      
      if (result.data.success) {
        setPotentialMatches(result.data.matches || []);
        if (result.data.matches && result.data.matches.length > 0) {
          setError(''); // Clear error if matches found
        }
      } else {
        setError(result.data.error || 'Failed to find matches');
      }
    } catch (err) {
      console.error('Error fetching matches:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatchRequests = () => {
    // Listen to match requests where user is involved
    const matchesQuery = query(
      collection(db, 'matches'),
      where('userA', '==', currentUser.uid)
    );
    
    const unsubscribe1 = onSnapshot(matchesQuery, async (snapshot) => {
      try {
        const requests = await Promise.all(
          snapshot.docs.map(async (doc) => {
            try {
              const data = doc.data();
              if (!data || !data.userB) {
                console.warn('[fetchMatchRequests] Missing userB in match:', doc.id);
                return null;
              }
              const otherUserDoc = await getDoc(doc(db, 'users', data.userB));
              const otherUser = otherUserDoc.exists() ? otherUserDoc.data() : {};
              return {
                id: doc.id,
                ...data,
                otherUser,
                isIncoming: false
              };
            } catch (err) {
              console.error('[fetchMatchRequests] Error processing doc:', doc.id, err);
              return null;
            }
          })
        );
        const validRequests = requests.filter(r => r !== null);
        updateMatchLists(validRequests, 'sent');
      } catch (error) {
        console.error('[fetchMatchRequests] Error in onSnapshot (userA):', error);
      }
    }, (error) => {
      console.error('[fetchMatchRequests] onSnapshot error (userA):', error);
    });

    const matchesQuery2 = query(
      collection(db, 'matches'),
      where('userB', '==', currentUser.uid)
    );
    
    const unsubscribe2 = onSnapshot(matchesQuery2, async (snapshot) => {
      try {
        const requests = await Promise.all(
          snapshot.docs.map(async (doc) => {
            try {
              const data = doc.data();
              if (!data || !data.userA) {
                console.warn('[fetchMatchRequests] Missing userA in match:', doc.id);
                return null;
              }
              const otherUserDoc = await getDoc(doc(db, 'users', data.userA));
              const otherUser = otherUserDoc.exists() ? otherUserDoc.data() : {};
              return {
                id: doc.id,
                ...data,
                otherUser,
                isIncoming: true
              };
            } catch (err) {
              console.error('[fetchMatchRequests] Error processing doc:', doc.id, err);
              return null;
            }
          })
        );
        const validRequests = requests.filter(r => r !== null);
        updateMatchLists(validRequests, 'received');
      } catch (error) {
        console.error('[fetchMatchRequests] Error in onSnapshot (userB):', error);
      }
    }, (error) => {
      console.error('[fetchMatchRequests] onSnapshot error (userB):', error);
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  };

  const updateMatchLists = (allRequests, source) => {
    try {
      if (!Array.isArray(allRequests)) {
        console.error('[updateMatchLists] allRequests is not an array:', allRequests);
        return;
      }

      const pending = allRequests.filter(r => r && r.status === 'pending');
      const mutual = allRequests.filter(r => r && (r.status === 'mutual' || r.status === 'accepted'));
      
      setPendingRequests(prev => {
        if (!Array.isArray(prev)) prev = [];
        const combined = [...prev.filter(r => r && r.isIncoming !== (source === 'received')), ...pending];
        return combined.filter((v, i, a) => v && v.id && a.findIndex(t => t && t.id === v.id) === i);
      });
      
      setMutualMatches(prev => {
        if (!Array.isArray(prev)) prev = [];
        const combined = [...prev, ...mutual];
        return combined.filter((v, i, a) => v && v.id && a.findIndex(t => t && t.id === v.id) === i);
      });
    } catch (error) {
      console.error('[updateMatchLists] Error updating match lists:', error, { allRequests, source });
    }
  };

  const handleSendRequest = async (match) => {
    try {
      // Check if match request already exists
      const matchesQuery = query(
        collection(db, 'matches'),
        where('userA', '==', currentUser.uid),
        where('userB', '==', match.userId),
        where('status', '==', 'pending')
      );
      const existingMatches = await getDocs(matchesQuery);
      
      if (!existingMatches.empty) {
        alert('You have already sent a request to this user');
        return;
      }

      // Get user's active ride request
      const rideRequestsQuery = query(
        collection(db, 'ride_requests'),
        where('userId', '==', currentUser.uid),
        where('status', '==', 'active')
      );
      const rideRequestsSnapshot = await getDocs(rideRequestsQuery);
      const userRideRequestId = rideRequestsSnapshot.docs[0].id;

      // Create match request
      await addDoc(collection(db, 'matches'), {
        userA: currentUser.uid,
        userB: match.userId,
        rideRequestA: userRideRequestId,
        rideRequestB: match.rideRequestId,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      alert('Share request sent! You will be notified when they accept.');
      fetchPotentialMatches();
    } catch (err) {
      console.error('Error sending request:', err);
      alert('Failed to send request: ' + err.message);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const handleAcceptRequest = async (matchId) => {
    try {
      await updateDoc(doc(db, 'matches', matchId), {
        status: 'accepted'
      });
      alert('Request accepted! You can now chat.');
    } catch (err) {
      console.error('Error accepting request:', err);
      alert('Failed to accept request: ' + err.message);
    }
  };

  const handleDeclineRequest = async (matchId) => {
    try {
      await updateDoc(doc(db, 'matches', matchId), {
        status: 'declined'
      });
    } catch (err) {
      console.error('Error declining request:', err);
      alert('Failed to decline request: ' + err.message);
    }
  };

  const renderMatchCard = (match, type) => {
    const isPotential = type === 'potential';
    const isPending = type === 'pending';
    const isMutual = type === 'mutual';
    const name = isPotential ? match.name : match.otherUser?.name || 'User';
    const gender = isPotential ? match.gender : match.otherUser?.gender || 'N/A';
    const age = isPotential ? match.age : match.otherUser?.age || null;
    const phone = isPotential ? match.phone : match.otherUser?.phone || 'Not provided';
    const photoUrl = isPotential ? match.photoUrl : match.otherUser?.photoUrl || null;
    const pickupText = isPotential ? match.pickupText : 'N/A';
    const dropText = isPotential ? match.dropText : 'N/A';
    const timeStart = isPotential ? match.timeStart : 'N/A';

    return (
      <div key={isPotential ? match.userId : match.id} className={`card group hover:border-primary-200 border-2 ${match.isNew ? 'border-green-300 bg-green-50/30' : 'border-transparent'}`}>
        {match.isNew && (
          <div className="mb-2 flex items-center gap-2">
            <span className="px-2 py-1 bg-green-500 text-white rounded-full text-xs font-semibold animate-pulse">
              🆕 New Match!
            </span>
          </div>
        )}
        <div className="flex items-start mb-4 sm:mb-6">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={name}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover mr-4 shadow-lg border-2 border-primary-200"
            />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-primary-500 to-accent-500 rounded-full flex items-center justify-center mr-4 shadow-lg">
              <span className="text-xl sm:text-2xl font-bold text-white">
                {name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
          )}
          <div className="flex-1">
            <h3 className="font-bold text-dark-900 text-base sm:text-lg mb-1">{name}</h3>
            <div className="space-y-1 text-sm text-dark-600">
              <p><span className="font-semibold">Gender:</span> {gender}</p>
              {age && <p><span className="font-semibold">Age:</span> {age} years</p>}
              <p><span className="font-semibold">Phone:</span> {phone}</p>
            </div>
          </div>
        </div>

        {isPotential && (
          <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
            <div>
              <p className="text-xs sm:text-sm text-dark-600"><span className="font-semibold">📍 Pickup:</span> {pickupText}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-dark-600"><span className="font-semibold">📍 Drop:</span> {dropText}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-dark-600">
                <span className="font-semibold">🕐 Time:</span> {new Date(timeStart).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <span className="text-sm sm:text-base font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
                ⭐ Score: {match.compatibilityScore || 0}%
              </span>
              <span className="text-xs sm:text-sm text-dark-500 font-medium">
                📏 {match.distance ? `${match.distance.toFixed(1)} km` : 'N/A'}
              </span>
            </div>
          </div>
        )}

        {isPotential && (
          <button
            onClick={() => handleSendRequest(match)}
            className="btn-primary w-full text-sm sm:text-base"
          >
            ✉️ Send Share Request
          </button>
        )}

        {isPending && match.isIncoming && (
          <div className="space-y-3">
            <p className="text-sm sm:text-base text-dark-600 mb-4 font-medium">📨 Sent you a share request</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => handleAcceptRequest(match.id)}
                className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white py-3 px-4 rounded-lg font-semibold hover:from-green-700 hover:to-green-800 shadow-md hover:shadow-lg transition-all"
              >
                ✓ Accept
              </button>
              <button
                onClick={() => handleDeclineRequest(match.id)}
                className="flex-1 bg-gradient-to-r from-red-600 to-red-700 text-white py-3 px-4 rounded-lg font-semibold hover:from-red-700 hover:to-red-800 shadow-md hover:shadow-lg transition-all"
              >
                ✕ Decline
              </button>
            </div>
          </div>
        )}

        {isPending && !match.isIncoming && (
          <div>
            <p className="text-sm sm:text-base text-dark-600 mb-3 font-medium">📤 Request sent - waiting for response</p>
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-3 text-sm sm:text-base text-yellow-700 font-semibold">
              ⏳ Pending
            </div>
          </div>
        )}

        {isMutual && (
          <div className="space-y-3">
            <p className="text-sm sm:text-base text-green-600 mb-4 font-semibold">✓ Mutual match! You can chat now.</p>
            <button
              onClick={() => navigate(`/chat/${match.id}`)}
              className="btn-primary w-full text-sm sm:text-base"
            >
              💬 Open Chat
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent mb-6 sm:mb-8">
            Your Matches
          </h1>

          {/* Real-time indicator */}
          <div className="mb-4 flex items-center gap-2 text-sm text-dark-600">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="font-medium">Real-time matching active</span>
            </div>
            <span className="text-xs">New matches appear automatically</span>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 sm:gap-4 mb-6 sm:mb-8 border-b-2 border-gray-200 pb-2">
            <button
              onClick={() => setActiveTab('potential')}
              className={`pb-3 px-4 sm:px-6 font-semibold text-sm sm:text-base transition-all ${
                activeTab === 'potential'
                  ? 'border-b-3 border-primary-600 text-primary-600'
                  : 'text-dark-600 hover:text-primary-600'
              }`}
            >
              Potential Matches <span className="ml-2 px-2 py-1 bg-primary-100 text-primary-700 rounded-full text-xs">{potentialMatches.length}</span>
              {potentialMatches.some(m => m.isNew) && (
                <span className="ml-1 px-2 py-0.5 bg-green-500 text-white rounded-full text-xs animate-pulse">New!</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`pb-3 px-4 sm:px-6 font-semibold text-sm sm:text-base transition-all ${
                activeTab === 'pending'
                  ? 'border-b-3 border-primary-600 text-primary-600'
                  : 'text-dark-600 hover:text-primary-600'
              }`}
            >
              Pending Requests <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">{pendingRequests.length}</span>
            </button>
            <button
              onClick={() => setActiveTab('mutual')}
              className={`pb-3 px-4 sm:px-6 font-semibold text-sm sm:text-base transition-all ${
                activeTab === 'mutual'
                  ? 'border-b-3 border-primary-600 text-primary-600'
                  : 'text-dark-600 hover:text-primary-600'
              }`}
            >
              Mutual Matches <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">{mutualMatches.length}</span>
            </button>
          </div>

          {error && (
            <div className="bg-yellow-50 border-2 border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg mb-6 text-sm sm:text-base">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <>
              {activeTab === 'potential' && (
                <>
                  {potentialMatches.length === 0 ? (
                    <div className="card text-center p-8 sm:p-12">
                      <p className="text-dark-600 text-base sm:text-lg">No potential matches found. Check back later!</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                      {potentialMatches.map((match) => renderMatchCard(match, 'potential'))}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'pending' && (
                <>
                  {pendingRequests.length === 0 ? (
                    <div className="card text-center p-8 sm:p-12">
                      <p className="text-dark-600 text-base sm:text-lg">No pending requests.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                      {pendingRequests.map((match) => renderMatchCard(match, 'pending'))}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'mutual' && (
                <>
                  {mutualMatches.length === 0 ? (
                    <div className="card text-center p-8 sm:p-12">
                      <p className="text-dark-600 text-base sm:text-lg">No mutual matches yet. Accept a request to start chatting!</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                      {mutualMatches.map((match) => renderMatchCard(match, 'mutual'))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default Matches;

