import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import Navbar from '../components/Navbar';
import ProtectedRoute from '../components/ProtectedRoute';

const Chat = () => {
  const { matchId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!matchId) return;

    // Get match details to find other user
    const fetchMatchDetails = async () => {
      try {
        const matchDoc = await getDoc(doc(db, 'matches', matchId));
        if (matchDoc.exists()) {
          const matchData = matchDoc.data();
          const otherUserId = matchData.userA === currentUser.uid ? matchData.userB : matchData.userA;
          
          const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
          if (otherUserDoc.exists()) {
            setOtherUser(otherUserDoc.data());
          }
        }
      } catch (err) {
        console.error('Error fetching match details:', err);
      }
    };

    fetchMatchDetails();

    // Subscribe to messages
    const messagesQuery = query(
      collection(db, 'chats', matchId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(messagesData);
    });

    return () => unsubscribe();
  }, [matchId, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await addDoc(collection(db, 'chats', matchId, 'messages'), {
        senderId: currentUser.uid,
        text: newMessage,
        timestamp: serverTimestamp()
      });
      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
      alert('Failed to send message');
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-6">
          {/* Chat Header */}
          <div className="bg-white/90 backdrop-blur-sm shadow-lg rounded-t-xl sm:rounded-t-2xl p-4 sm:p-6 flex items-center border-b-2 border-gray-200">
            <button
              onClick={() => navigate('/matches')}
              className="mr-3 sm:mr-4 text-dark-600 hover:text-primary-600 font-semibold text-sm sm:text-base transition-colors"
            >
              ← Back
            </button>
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-primary-500 to-accent-500 rounded-full flex items-center justify-center mr-3 sm:mr-4 shadow-lg">
              <span className="text-lg sm:text-xl font-bold text-white">
                {otherUser?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div>
              <h2 className="font-bold text-dark-900 text-base sm:text-lg">{otherUser?.name || 'User'}</h2>
              <p className="text-xs sm:text-sm text-dark-500">Active now</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 bg-white/90 backdrop-blur-sm shadow-lg rounded-b-xl sm:rounded-b-2xl p-4 sm:p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            {messages.length === 0 ? (
              <div className="text-center text-dark-500 py-12 sm:py-16">
                <p className="text-base sm:text-lg">No messages yet. Start the conversation! 💬</p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {messages.map((message) => {
                  const isOwn = message.senderId === currentUser.uid;
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs sm:max-w-md lg:max-w-lg px-4 sm:px-5 py-2 sm:py-3 rounded-2xl shadow-md ${
                          isOwn
                            ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-br-sm'
                            : 'bg-gray-100 text-dark-900 rounded-bl-sm'
                        }`}
                      >
                        <p className="text-sm sm:text-base break-words">{message.text}</p>
                        {message.timestamp && (
                          <p
                            className={`text-xs mt-1 ${
                              isOwn ? 'text-primary-100' : 'text-dark-500'
                            }`}
                          >
                            {message.timestamp.toDate
                              ? message.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : 'Just now'}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Message Input */}
          <form onSubmit={sendMessage} className="mt-4 flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 input-field rounded-l-xl sm:rounded-l-2xl"
            />
            <button
              type="submit"
              className="btn-primary rounded-r-xl sm:rounded-r-2xl px-6 sm:px-8"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default Chat;

