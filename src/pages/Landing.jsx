import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

const Landing = () => {
  const { currentUser } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      <Navbar />
      
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 lg:py-24">
        <div className="text-center">
          <div className="mb-6">
            <span className="inline-block px-4 py-2 bg-primary-100 text-primary-700 rounded-full text-sm font-semibold mb-4">
              🚗 Smart Cab Sharing Platform
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary-600 via-accent-600 to-primary-700 mb-6 leading-tight">
            RideBuddy
          </h1>
          <p className="text-xl sm:text-2xl md:text-3xl font-semibold text-dark-700 mb-4">
            Share your cab. Save money. Travel smarter.
          </p>
          <p className="text-base sm:text-lg md:text-xl text-dark-600 mb-8 sm:mb-12 max-w-3xl mx-auto px-4">
            Connect with fellow travelers going your way. Split cab fares and make your journey more affordable and enjoyable.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {!currentUser && (
              <Link
                to="/login"
                className="btn-primary text-base sm:text-lg px-8 sm:px-10 py-4 sm:py-5 w-full sm:w-auto"
              >
                Find a Ride Partner
              </Link>
            )}
            {currentUser && (
              <Link
                to="/create-ride"
                className="btn-primary text-base sm:text-lg px-8 sm:px-10 py-4 sm:py-5 w-full sm:w-auto"
              >
                Create a Ride Request
              </Link>
            )}
          </div>
        </div>

        {/* 3-Step Explanation */}
        <div className="mt-16 sm:mt-20 md:mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 lg:gap-10">
          <div className="card group hover:border-primary-200 border-2 border-transparent">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center mb-6 mx-auto shadow-lg group-hover:scale-110 transition-transform duration-300">
              <span className="text-2xl sm:text-3xl font-bold text-white">1</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-dark-900 mb-4 text-center">
              Enter your trip
            </h3>
            <p className="text-dark-600 text-center text-sm sm:text-base leading-relaxed">
              Tell us where you're going and when. We'll find the perfect match for your journey.
            </p>
          </div>

          <div className="card group hover:border-accent-200 border-2 border-transparent">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-accent-500 to-accent-600 rounded-full flex items-center justify-center mb-6 mx-auto shadow-lg group-hover:scale-110 transition-transform duration-300">
              <span className="text-2xl sm:text-3xl font-bold text-white">2</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-dark-900 mb-4 text-center">
              Find matching riders
            </h3>
            <p className="text-dark-600 text-center text-sm sm:text-base leading-relaxed">
              Our smart algorithm matches you with people going the same way at the same time.
            </p>
          </div>

          <div className="card group hover:border-primary-200 border-2 border-transparent">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-primary-600 to-accent-600 rounded-full flex items-center justify-center mb-6 mx-auto shadow-lg group-hover:scale-110 transition-transform duration-300">
              <span className="text-2xl sm:text-3xl font-bold text-white">3</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-dark-900 mb-4 text-center">
              Share & split the cab fare
            </h3>
            <p className="text-dark-600 text-center text-sm sm:text-base leading-relaxed">
              Connect, chat, and split the fare. Travel together and save money.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-dark-800 to-dark-900 text-white mt-20 sm:mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 sm:gap-12">
            <div>
              <h4 className="text-xl font-bold mb-4 text-primary-300">About</h4>
              <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
                RideBuddy helps you find travel companions and split cab fares, making your journey more affordable.
              </p>
            </div>
            <div>
              <h4 className="text-xl font-bold mb-4 text-primary-300">Contact</h4>
              <p className="text-gray-300 text-sm sm:text-base">
                Email: support@ridebuddy.com
              </p>
              <p className="text-gray-300 text-sm sm:text-base mt-2">
                Phone: +1 (555) 123-4567
              </p>
            </div>
            <div>
              <h4 className="text-xl font-bold mb-4 text-primary-300">Legal</h4>
              <div className="flex flex-col space-y-2 text-gray-300 text-sm sm:text-base">
                <a href="#" className="hover:text-primary-300 transition-colors">Terms of Service</a>
                <a href="#" className="hover:text-primary-300 transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-primary-300 transition-colors">Cookie Policy</a>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-gray-700 text-center text-gray-400 text-sm sm:text-base">
            <p>&copy; 2024 RideBuddy. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
