import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUnreadCount } from '../hooks/useUnreadCount';

const Navbar = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const unreadCount = useUnreadCount(currentUser?.uid);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
      setMobileMenuOpen(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <nav className="bg-white/95 backdrop-blur-sm shadow-lg sticky top-0 z-50 border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 sm:h-20">
          <div className="flex items-center">
            <Link to="/" className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent hover:from-primary-700 hover:to-accent-700 transition-all">
              RideBuddy
            </Link>
          </div>
          
          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-2 lg:space-x-4">
            {currentUser ? (
              <>
                <Link
                  to="/create-ride"
                  className="text-dark-700 hover:text-primary-600 px-3 lg:px-4 py-2 rounded-lg text-sm lg:text-base font-medium hover:bg-primary-50 transition-colors"
                >
                  Create Ride
                </Link>
                <Link
                  to="/my-requests"
                  className="text-dark-700 hover:text-primary-600 px-3 lg:px-4 py-2 rounded-lg text-sm lg:text-base font-medium hover:bg-primary-50 transition-colors"
                >
                  My Requests
                </Link>
                <Link
                  to="/matches"
                  className="relative text-dark-700 hover:text-primary-600 px-3 lg:px-4 py-2 rounded-lg text-sm lg:text-base font-medium hover:bg-primary-50 transition-colors"
                >
                  Matches
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>
                <button
                  onClick={handleLogout}
                  className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 lg:px-6 py-2 rounded-lg text-sm lg:text-base font-semibold hover:from-primary-700 hover:to-primary-800 shadow-md hover:shadow-lg transition-all"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 lg:px-6 py-2 rounded-lg text-sm lg:text-base font-semibold hover:from-primary-700 hover:to-primary-800 shadow-md hover:shadow-lg transition-all"
              >
                Login
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-dark-700 hover:text-primary-600 p-2 rounded-lg"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <div className="flex flex-col space-y-2">
              {currentUser ? (
                <>
                  <Link
                    to="/create-ride"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-dark-700 hover:text-primary-600 px-4 py-2 rounded-lg font-medium hover:bg-primary-50 transition-colors"
                  >
                    Create Ride
                  </Link>
                  <Link
                    to="/my-requests"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-dark-700 hover:text-primary-600 px-4 py-2 rounded-lg font-medium hover:bg-primary-50 transition-colors"
                  >
                    My Requests
                  </Link>
                  <Link
                    to="/matches"
                    onClick={() => setMobileMenuOpen(false)}
                    className="relative text-dark-700 hover:text-primary-600 px-4 py-2 rounded-lg font-medium hover:bg-primary-50 transition-colors"
                  >
                    Matches
                    {unreadCount > 0 && (
                      <span className="absolute top-2 right-4 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-2 rounded-lg font-semibold hover:from-primary-700 hover:to-primary-800 text-left"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-2 rounded-lg font-semibold hover:from-primary-700 hover:to-primary-800 text-center"
                >
                  Login
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
