import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { applyActionCode } from 'firebase/auth';
import Navbar from '../components/Navbar';
import { auth } from '../firebase/config';

const VerifyEmail = () => {
  const [params] = useSearchParams();
  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const mode = params.get('mode');
    const oobCode = params.get('oobCode');

    if (mode !== 'verifyEmail' || !oobCode) {
      setStatus('error');
      setMessage('Invalid verification link. Please request a new verification email.');
      return;
    }

    (async () => {
      try {
        await applyActionCode(auth, oobCode);
        setStatus('success');
        setMessage('Email verified successfully. You can now log in.');
      } catch (e) {
        console.error('[VerifyEmail] applyActionCode failed:', e);
        setStatus('error');
        setMessage(
          'Verification link is invalid or expired. Please log in and request a new verification email.'
        );
      }
    })();
  }, [params]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      <Navbar />
      <div className="flex items-center justify-center py-10 px-4">
        <div className="max-w-md w-full bg-white/90 backdrop-blur-sm p-6 sm:p-8 rounded-2xl shadow-2xl border border-gray-100">
          <h1 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent mb-3">
            Verify Email
          </h1>

          {status === 'verifying' && (
            <p className="text-dark-700 text-sm sm:text-base">Verifying your email…</p>
          )}

          {status !== 'verifying' && (
            <div
              className={`mt-4 border-2 rounded-lg px-4 py-3 text-sm sm:text-base ${
                status === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {message}
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <Link
              to="/login"
              className="btn-primary flex-1 text-center"
            >
              Go to Login
            </Link>
            <Link
              to="/"
              className="btn-secondary flex-1 text-center"
            >
              Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;

