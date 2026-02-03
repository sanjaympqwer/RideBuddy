import { Device } from '@twilio/voice-sdk';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';

let device = null;
let deviceInitializing = null;
let activeCall = null;
const incomingCallListeners = new Set();
const callStateListeners = new Set();

export function onIncomingCall(listener) {
  incomingCallListeners.add(listener);
  return () => incomingCallListeners.delete(listener);
}

export function onCallStateChange(listener) {
  callStateListeners.add(listener);
  return () => callStateListeners.delete(listener);
}

function notifyIncomingCall(call) {
  incomingCallListeners.forEach((fn) => {
    try {
      fn(call);
    } catch (e) {
      console.error('[twilioClient] Error in incomingCall listener', e);
    }
  });
}

function notifyCallState(state) {
  callStateListeners.forEach((fn) => {
    try {
      fn(state);
    } catch (e) {
      console.error('[twilioClient] Error in callState listener', e);
    }
  });
}

async function fetchToken() {
  const getTwilioToken = httpsCallable(functions, 'getTwilioToken');
  const result = await getTwilioToken();
  if (!result.data || !result.data.token) {
    throw new Error('Failed to fetch Twilio token');
  }
  return result.data.token;
}

async function initDevice() {
  if (device) return device;
  if (deviceInitializing) return deviceInitializing;

  deviceInitializing = (async () => {
    const token = await fetchToken();
    const dev = new Device(token, {
      logLevel: 'error',
    });

    dev.on('registered', () => {
      console.log('[twilioClient] Device registered');
    });

    dev.on('error', (error) => {
      console.error('[twilioClient] Device error:', error);
    });

    dev.on('incoming', (call) => {
      console.log('[twilioClient] Incoming call from', call.parameters.from);
      notifyIncomingCall(call);
    });

    // Automatically re-register if token is about to expire could be added later

    // Register for incoming calls
    await dev.register();

    device = dev;
    deviceInitializing = null;
    return dev;
  })();

  return deviceInitializing;
}

export async function startCall(matchId) {
  if (!matchId) {
    throw new Error('matchId is required to start a call');
  }

  const dev = await initDevice();
  notifyCallState({ status: 'connecting', matchId });

  const call = await dev.connect({ params: { matchId } });
  activeCall = call;

  call.on('accept', () => {
    console.log('[twilioClient] Call accepted');
    notifyCallState({ status: 'in-call', matchId });
  });

  call.on('disconnect', () => {
    console.log('[twilioClient] Call disconnected');
    if (activeCall === call) {
      activeCall = null;
    }
    notifyCallState({ status: 'idle', matchId: null });
  });

  call.on('error', (error) => {
    console.error('[twilioClient] Call error:', error);
    notifyCallState({ status: 'error', error, matchId });
  });

  return call;
}

export async function hangupCall() {
  if (activeCall) {
    try {
      activeCall.disconnect();
    } catch (e) {
      console.error('[twilioClient] Error hanging up call', e);
    } finally {
      activeCall = null;
      notifyCallState({ status: 'idle', matchId: null });
    }
  }
}

