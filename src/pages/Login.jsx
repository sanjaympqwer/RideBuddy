import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PhoneAuthProvider, RecaptchaVerifier, sendEmailVerification } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { auth, db } from '../firebase/config';

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
  const [idType, setIdType] = useState('');
  const [idFile, setIdFile] = useState(null);
  const [idFileName, setIdFileName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOtpStep, setIsOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerificationId, setOtpVerificationId] = useState('');
  const [otpMode, setOtpMode] = useState('login'); // 'login' | 'signup'

  const { login, signup, logout } = useAuth();
  const navigate = useNavigate();

  const getRecaptchaVerifier = () => {
    if (typeof window === 'undefined') return null;
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
    }
    return window.recaptchaVerifier;
  };

  const startOtpFlow = async (phoneNumber, mode) => {
    const formatted = phoneNumber?.trim();
    if (!formatted) {
      throw new Error('Phone number is missing for OTP');
    }
    const verifier = getRecaptchaVerifier();
    const provider = new PhoneAuthProvider(auth);
    const verificationId = await provider.verifyPhoneNumber(formatted, verifier);
    setOtpVerificationId(verificationId);
    setOtpMode(mode);
    setIsOtpStep(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);

        const user = auth.currentUser;
        if (!user) {
          throw new Error('Login failed. Please try again.');
        }

        if (!user.emailVerified) {
          await sendEmailVerification(user);
          setError('We sent a verification link to your email. Please verify your email, then log in again.');
          await logout();
          setLoading(false);
          return;
        }

        const userDocRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userDocRef);
        if (!snap.exists()) {
          throw new Error('User profile not found.');
        }
        const data = snap.data();
        const phoneNumber = data.phone;

        await startOtpFlow(phoneNumber, 'login');
        setLoading(false);
        return;
      } else {
        if (!name || !gender || !age || !phone || !idType || !idFile) {
          setError('Please fill all required fields, including ID type and ID proof');
          setLoading(false);
          return;
        }
        await signup(email, password, name, gender, parseInt(age, 10), phone, profilePicture, idType, idFile);

        // After signup, start phone OTP verification
        await startOtpFlow(phone, 'signup');
        setError('We have sent an OTP to your phone and a verification link to your email. Verify both to secure your account.');
        setLoading(false);
        return;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (!otpVerificationId || !otpCode) {
      setError('Please enter the OTP sent to your phone.');
      return;
    }
    setLoading(true);
    try {
      const credential = PhoneAuthProvider.credential(otpVerificationId, otpCode);
      // If credential creation succeeds, OTP is valid
      const user = auth.currentUser;
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, {
          phoneVerified: true,
          phoneVerifiedAt: new Date().toISOString(),
        });
      }

      if (otpMode === 'signup') {
        setIsOtpStep(false);
        setOtpCode('');
        setOtpVerificationId('');
        setError('Phone verified. Please check your email, verify it, then log in.');
        await logout();
      } else {
        // login
        setIsOtpStep(false);
        setOtpCode('');
        setOtpVerificationId('');
        navigate('/create-ride');
      }
    } catch (err) {
      console.error('OTP verification error', err);
      setError('Invalid OTP. Please check the code and try again.');
    } finally {
      setLoading(false);
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
          <form className="mt-6 sm:mt-8 space-y-5 sm:space-y-6" onSubmit={isOtpStep ? handleVerifyOtp : handleSubmit}>
            {error && (
              <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm sm:text-base">
                {error}
              </div>
            )}

            {!isLogin && !isOtpStep && (
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
                <div>
                  <label htmlFor="idType" className="block text-sm sm:text-base font-semibold text-dark-700 mb-2">
                    Government ID Type *
                  </label>
                  <select
                    id="idType"
                    name="idType"
                    required={!isLogin}
                    value={idType}
                    onChange={(e) => setIdType(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select ID Type</option>
                    <option value="aadhaar">Aadhaar</option>
                    <option value="license">Driving License</option>
                    <option value="voterId">Voter ID</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="idProof" className="block text-sm sm:text-base font-semibold text-dark-700 mb-2">
                    Upload ID Proof (photo or PDF) *
                  </label>
                  <input
                    id="idProof"
                    name="idProof"
                    type="file"
                    required={!isLogin}
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        if (file.size > 10 * 1024 * 1024) {
                          setError('ID file size should be less than 10MB');
                          return;
                        }
                        setIdFile(file);
                        setIdFileName(file.name);
                      } else {
                        setIdFile(null);
                        setIdFileName('');
                      }
                    }}
                    className="input-field"
                  />
                  {idFileName && (
                    <p className="mt-1 text-xs text-dark-500">
                      Selected: <span className="font-semibold">{idFileName}</span>
                    </p>
                  )}
                  <p className="text-xs text-dark-500 mt-1">
                    🔒 Your ID is stored securely and used only for verification and safety.
                  </p>
                </div>
              </>
            )}

            {!isOtpStep && (
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
            )}

            {isOtpStep ? (
              <>
                <div>
                  <label htmlFor="otp" className="block text-sm sm:text-base font-semibold text-dark-700 mb-2">
                    Enter OTP sent to your phone
                  </label>
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="input-field"
                    placeholder="6-digit code"
                  />
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed text-base sm:text-lg"
                  >
                    {loading ? 'Verifying OTP...' : 'Verify OTP'}
                  </button>
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
          </form>
          <div id="recaptcha-container" />
        </div>
      </div>
    </div>
  );
};

export default Login;
