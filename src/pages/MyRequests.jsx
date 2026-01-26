import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import Navbar from '../components/Navbar';
import ProtectedRoute from '../components/ProtectedRoute';

const MyRequests = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMyRequests();
    
    // Set up real-time listener
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'ride_requests'),
        where('userId', '==', currentUser.uid)
      ),
      (snapshot) => {
        const requestsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setRequests(requestsData);
        setLoading(false);
      },
      (err) => {
        console.error('Error listening to requests:', err);
        setError('Failed to load your requests');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  const fetchMyRequests = async () => {
    try {
      setLoading(true);
      const requestsQuery = query(
        collection(db, 'ride_requests'),
        where('userId', '==', currentUser.uid)
      );
      const snapshot = await getDocs(requestsQuery);
      
      const requestsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort by creation date (newest first)
      requestsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      setRequests(requestsData);
    } catch (err) {
      console.error('Error fetching requests:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (requestId) => {
    if (!window.confirm('Are you sure you want to deactivate this ride request?')) {
      return;
    }

    try {
      await updateDoc(doc(db, 'ride_requests', requestId), {
        status: 'inactive'
      });
    } catch (err) {
      console.error('Error deactivating request:', err);
      alert('Failed to deactivate request: ' + err.message);
    }
  };

  const handleViewMatches = (requestId) => {
    navigate(`/matches?requestId=${requestId}`);
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
          <Navbar />
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const activeRequests = requests.filter(r => r.status === 'active');
  const inactiveRequests = requests.filter(r => r.status !== 'active');

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
        <Navbar />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="flex justify-between items-center mb-6 sm:mb-8">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
              My Ride Requests
            </h1>
            <button
              onClick={() => navigate('/create-ride')}
              className="btn-primary text-sm sm:text-base"
            >
              + New Request
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm sm:text-base">
              {error}
            </div>
          )}

          {/* Active Requests */}
          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-dark-900 mb-4">
              Active Requests ({activeRequests.length})
            </h2>
            {activeRequests.length === 0 ? (
              <div className="card text-center p-8 sm:p-12">
                <p className="text-dark-600 text-base sm:text-lg mb-4">No active requests.</p>
                <button
                  onClick={() => navigate('/create-ride')}
                  className="btn-primary"
                >
                  Create Your First Ride Request
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {activeRequests.map((request) => (
                  <div key={request.id} className="card group hover:border-primary-200 border-2 border-transparent">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                            Active
                          </span>
                          <span className="text-xs text-dark-500">
                            {new Date(request.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="font-bold text-dark-900 text-lg mb-2">
                          {request.pickupText}
                        </h3>
                        <p className="text-sm text-dark-600 mb-1">
                          <span className="font-semibold">📍 To:</span> {request.dropText}
                        </p>
                        <p className="text-sm text-dark-600">
                          <span className="font-semibold">🕐 Time:</span> {new Date(request.timeStart).toLocaleString()} - {new Date(request.timeEnd).toLocaleString()}
                        </p>
                        {request.notes && (
                          <p className="text-sm text-dark-500 mt-2 italic">
                            Note: {request.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => handleViewMatches(request.id)}
                        className="btn-primary flex-1 text-sm sm:text-base"
                      >
                        View Matches
                      </button>
                      <button
                        onClick={() => handleDeactivate(request.id)}
                        className="btn-secondary flex-1 text-sm sm:text-base"
                      >
                        Deactivate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inactive Requests */}
          {inactiveRequests.length > 0 && (
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-dark-900 mb-4">
                Past Requests ({inactiveRequests.length})
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {inactiveRequests.map((request) => (
                  <div key={request.id} className="card opacity-75">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">
                            Inactive
                          </span>
                          <span className="text-xs text-dark-500">
                            {new Date(request.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="font-bold text-dark-900 text-lg mb-2">
                          {request.pickupText}
                        </h3>
                        <p className="text-sm text-dark-600">
                          <span className="font-semibold">📍 To:</span> {request.dropText}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default MyRequests;
