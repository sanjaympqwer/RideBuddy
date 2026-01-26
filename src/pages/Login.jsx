import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, signup, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        if (!name || !gender || !age || !phone) {
          setError('Please fill all required fields');
          setLoading(false);
          return;
        }
        await signup(email, password, name, gender, parseInt(age), phone, profilePicture);
      }
      navigate('/create-ride');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      // Use redirect method (more reliable, doesn't get blocked by popup blockers)
      const result = await loginWithGoogle(true);
      
      // If redirect method is used, user will be redirected to Google
      // and then back to the app, so we don't navigate here
      // The redirect result is handled in AuthContext
      if (result) {
        // Only navigate if popup method succeeded
        navigate('/create-ride');
      }
      // If redirect, the page will reload after Google authentication
    } catch (err) {
      setLoading(false);
      let errorMessage = err.message;
      
      if (err.code === 'auth/popup-blocked') {
        errorMessage = 'Popup blocked! The page will redirect to Google for sign-in. Please allow popups or wait for redirect.';
        // Try redirect method as fallback
        try {
          await loginWithGoogle(true);
        } catch (redirectErr) {
          errorMessage = 'Unable to sign in. Please check your browser settings and try again.';
        }
      } else if (err.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign-in cancelled. Please try again.';
      } else if (err.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      }
      
      setError(errorMessage);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      <Navbar />
      <div className="flex items-center justify-center py-8 sm:py-12 lg:py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-white/90 backdrop-blur-sm p-6 sm:p-8 lg:p-10 rounded-2xl shadow-2xl border border-gray-100">
          <div>
            <h2 className="mt-2 sm:mt-6 text-center text-2xl sm:text-3xl lg:text-4xl font-extrabold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
              {isLogin ? 'Sign in to your account' : 'Create your account'}
            </h2>
            <p className="mt-2 text-center text-sm sm:text-base text-dark-600">
              {isLogin ? "Welcome back!" : "Join RideBuddy today"}
            </p>
          </div>
          <form className="mt-6 sm:mt-8 space-y-5 sm:space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm sm:text-base">
                {error}
              </div>
            )}

            {!isLogin && (
              <>
                <div>
                  <label htmlFor="name" className="block text-sm sm:text-base font-semibold text-dark-700 mb-2">
                    Full Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required={!isLogin}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-field"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label htmlFor="gender" className="block text-sm sm:text-base font-semibold text-dark-700 mb-2">
                    Gender
                  </label>
                  <select
                    id="gender"
                    name="gender"
                    required={!isLogin}
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="age" className="block text-sm sm:text-base font-semibold text-dark-700 mb-2">
                    Age
                  </label>
                  <input
                    id="age"
                    name="age"
                    type="number"
                    required={!isLogin}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="input-field"
                    placeholder="25"
                    min="18"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm sm:text-base font-semibold text-dark-700 mb-2">
                    Phone Number *
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    required={!isLogin}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input-field"
                    placeholder="+91 9876543210"
                  />
                </div>
                <div>
                  <label htmlFor="profilePicture" className="block text-sm sm:text-base font-semibold text-dark-700 mb-2">
                    Profile Picture
                  </label>
                  <div className="space-y-3">
                    <input
                      id="profilePicture"
                      name="profilePicture"
                      type="file"
                      accept="image/*"
                      capture="user"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) {
                            setError('Image size should be less than 5MB');
                            return;
                          }
                          setProfilePicture(file);
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setProfilePicturePreview(reader.result);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="input-field"
                    />
                    {profilePicturePreview && (
                      <div className="mt-2">
                        <img
                          src={profilePicturePreview}
                          alt="Profile preview"
                          className="w-24 h-24 rounded-full object-cover border-2 border-primary-300"
                        />
                      </div>
                    )}
                    <p className="text-xs text-dark-500">
                      📷 You can take a photo with your camera or choose from gallery
                    </p>
                  </div>
                </div>
              </>
            )}

            <div>
              <label htmlFor="email" className="block text-sm sm:text-base font-semibold text-dark-700 mb-2">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="Email address"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm sm:text-base font-semibold text-dark-700 mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Password"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed text-base sm:text-lg"
              >
                {loading ? 'Processing...' : (isLogin ? 'Sign in' : 'Sign up')}
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-dark-500">Or continue with</span>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex justify-center items-center py-3 px-4 border-2 border-gray-300 rounded-lg shadow-sm text-sm sm:text-base font-semibold text-dark-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 transition-all"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="text-primary-600 hover:text-primary-700 font-semibold text-sm sm:text-base"
              >
                {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
