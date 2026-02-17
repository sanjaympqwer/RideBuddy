import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import CreateRide from './pages/CreateRide';
import Matches from './pages/Matches';
import MyRequests from './pages/MyRequests';
import Chat from './pages/Chat';
import PaymentSplit from './pages/PaymentSplit';
import CallBar from './components/CallBar';
import History from './pages/History';
import VerifyEmail from './pages/VerifyEmail';

function App() {
  return (
    <Router>
      <AuthProvider>
        <>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/create-ride" element={<CreateRide />} />
            <Route path="/my-requests" element={<MyRequests />} />
            <Route path="/matches" element={<Matches />} />
            <Route path="/chat/:matchId" element={<Chat />} />
            <Route path="/payment-split" element={<PaymentSplit />} />
            <Route path="/history" element={<History />} />
          </Routes>
          <CallBar />
        </>
      </AuthProvider>
    </Router>
  );
}

export default App;
