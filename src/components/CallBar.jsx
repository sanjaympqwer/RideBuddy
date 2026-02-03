import { useEffect, useState } from 'react';
import { onCallStateChange, hangupCall } from '../voice/twilioClient';

const CallBar = () => {
  const [state, setState] = useState({ status: 'idle', matchId: null });

  useEffect(() => {
    const unsubscribe = onCallStateChange(setState);
    return () => unsubscribe();
  }, []);

  if (state.status === 'idle' || !state.matchId) {
    return null;
  }

  const label =
    state.status === 'connecting'
      ? 'Connecting...'
      : state.status === 'in-call'
      ? 'In call'
      : 'Call error';

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-4 sm:pb-6 pointer-events-none">
      <div className="pointer-events-auto max-w-md w-full bg-dark-800 text-white rounded-2xl shadow-2xl flex items-center justify-between px-4 py-3 gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm sm:text-base font-semibold">{label}</span>
        </div>
        <button
          onClick={hangupCall}
          className="bg-red-600 hover:bg-red-700 text-white text-sm sm:text-base font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-md"
        >
          End
        </button>
      </div>
    </div>
  );
};

export default CallBar;

