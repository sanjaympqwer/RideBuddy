import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ProtectedRoute from '../components/ProtectedRoute';

const PaymentSplit = () => {
  const navigate = useNavigate();
  const [totalFare, setTotalFare] = useState('');
  const [numberOfPeople, setNumberOfPeople] = useState(2);
  const [splitAmount, setSplitAmount] = useState(0);

  const calculateSplit = () => {
    if (totalFare && numberOfPeople > 0) {
      const amount = parseFloat(totalFare) / numberOfPeople;
      setSplitAmount(amount);
    } else {
      setSplitAmount(0);
    }
  };

  useEffect(() => {
    calculateSplit();
  }, [totalFare, numberOfPeople]);

  const copyUPI = () => {
    const upiId = `ridebuddy@paytm`; // Replace with actual UPI ID
    const upiLink = `upi://pay?pa=${upiId}&am=${splitAmount.toFixed(2)}&cu=INR&tn=RideBuddy%20Payment`;
    
    navigator.clipboard.writeText(upiLink).then(() => {
      alert('UPI link copied to clipboard!');
    }).catch(() => {
      alert(`UPI ID: ${upiId}\nAmount: ₹${splitAmount.toFixed(2)}`);
    });
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="bg-white/90 backdrop-blur-sm shadow-2xl rounded-2xl p-6 sm:p-8 lg:p-10 border border-gray-100">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent mb-6 sm:mb-8">
              💰 Split Payment
            </h1>

            <div className="space-y-6 sm:space-y-8">
              <div>
                <label htmlFor="totalFare" className="block text-sm sm:text-base font-semibold text-dark-700 mb-2">
                  Total Cab Fare (₹)
                </label>
                <input
                  id="totalFare"
                  type="number"
                  value={totalFare}
                  onChange={(e) => setTotalFare(e.target.value)}
                  placeholder="Enter total fare"
                  min="0"
                  step="0.01"
                  className="input-field"
                />
              </div>

              <div>
                <label htmlFor="numberOfPeople" className="block text-sm sm:text-base font-semibold text-dark-700 mb-2">
                  Number of People
                </label>
                <input
                  id="numberOfPeople"
                  type="number"
                  value={numberOfPeople}
                  onChange={(e) => setNumberOfPeople(parseInt(e.target.value) || 2)}
                  min="2"
                  max="10"
                  className="input-field"
                />
              </div>

              {splitAmount > 0 && (
                <div className="bg-gradient-to-br from-primary-50 to-accent-50 border-2 border-primary-200 rounded-xl sm:rounded-2xl p-6 sm:p-8 shadow-lg">
                  <h3 className="text-lg sm:text-xl font-bold text-dark-900 mb-3">Split Amount</h3>
                  <p className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent mb-4">
                    ₹{splitAmount.toFixed(2)}
                  </p>
                  <p className="text-sm sm:text-base text-dark-600 font-medium">
                    Each person pays: ₹{splitAmount.toFixed(2)}
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <button
                  onClick={copyUPI}
                  disabled={splitAmount === 0}
                  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed text-base sm:text-lg"
                >
                  📋 Copy UPI Payment Link
                </button>
                <button
                  onClick={() => navigate('/matches')}
                  className="btn-secondary flex-1 text-base sm:text-lg"
                >
                  ← Back to Matches
                </button>
              </div>

              <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-yellow-50 border-2 border-yellow-200 rounded-xl">
                <p className="text-sm sm:text-base text-yellow-800">
                  <strong>💡 Note:</strong> This is a basic payment split calculator. 
                  For actual payments, use your preferred UPI app (Google Pay, PhonePe, Paytm) 
                  and send the calculated amount to your ride partner.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default PaymentSplit;

