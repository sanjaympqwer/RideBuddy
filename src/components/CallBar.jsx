import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { acceptIncomingCall, ensureDeviceRegistered, hangupCall, onCallStateChange, rejectIncomingCall } from '../voice/twilioClient';

const CallBar = () => {
  const { currentUser } = useAuth();
  const [state, setState] = useState({ status: 'idle', matchId: null, from: '' });
  const [deviceReady, setDeviceReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onCallStateChange(setState);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setDeviceReady(false);

    if (!currentUser) return () => {};

    (async () => {
      try {
        await ensureDeviceRegistered();
        if (!cancelled) setDeviceReady(true);
      } catch (e) {
        console.error('[CallBar] Failed to init Twilio device', e);
        if (!cancelled) setDeviceReady(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  if (state.status === 'idle' || (!state.matchId && state.status !== 'incoming')) {
    return null;
  }

  const label =
    state.status === 'incoming'
      ? 'Incoming call…'
      : state.status === 'connecting'
      ? 'Connecting...'
      : state.status === 'in-call'
      ? 'In call'
      : 'Call error';

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-4 sm:pb-6 pointer-events-none">
      <div className="pointer-events-auto max-w-md w-full bg-dark-800 text-white rounded-2xl shadow-2xl flex items-center justify-between px-4 py-3 gap-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex w-2 h-2 rounded-full ${state.status === 'incoming' ? 'bg-yellow-400' : 'bg-green-400'} animate-pulse`} />
          <div className="flex flex-col leading-tight">
            <span className="text-sm sm:text-base font-semibold">{label}</span>
            {state.status === 'incoming' && (
              <span className="text-xs sm:text-sm text-white/80">
                {deviceReady ? 'Tap Receive to answer' : 'Preparing call…'}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {state.status === 'incoming' && (
            <button
              onClick={async () => {
                try {
                  await acceptIncomingCall();
                } catch (_) {
                  // state listener will show error/idle
                }
              }}
              disabled={!deviceReady}
              className={`text-white text-sm sm:text-base font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-md ${
                deviceReady ? 'bg-green-600 hover:bg-green-700' : 'bg-green-900 opacity-60 cursor-not-allowed'
              }`}
            >
              Receive
            </button>
          )}
          <button
            onClick={state.status === 'incoming' ? rejectIncomingCall : hangupCall}
            className="bg-red-600 hover:bg-red-700 text-white text-sm sm:text-base font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-md"
          >
            End
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallBar;

