import { Device } from '@twilio/voice-sdk';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';

let device = null;
let deviceInitializing = null;
let activeCall = null;
let pendingIncomingCall = null;
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

function getParam(call, key) {
  try {
    if (call?.customParameters?.get) {
      const v = call.customParameters.get(key);
      if (v != null && `${v}`.length) return `${v}`;
    }
  } catch (_) {
    // ignore
  }
  try {
    const v = call?.parameters?.[key];
    if (v != null && `${v}`.length) return `${v}`;
  } catch (_) {
    // ignore
  }
  return null;
}

function extractIncomingMeta(call) {
  const from = getParam(call, 'From') || getParam(call, 'from') || '';
  const matchId = getParam(call, 'matchId') || getParam(call, 'To') || getParam(call, 'to') || null;
  return { from, matchId };
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
      const meta = extractIncomingMeta(call);
      console.log('[twilioClient] Incoming call', meta);

      // If another call is already in progress, reject this one to avoid confusion.
      if (activeCall) {
        try {
          call.reject();
        } catch (e) {
          console.error('[twilioClient] Failed rejecting incoming while active', e);
        }
        return;
      }

      pendingIncomingCall = call;
      notifyIncomingCall(call);
      notifyCallState({ status: 'incoming', matchId: meta.matchId, from: meta.from });

      call.on('cancel', () => {
        if (pendingIncomingCall === call) {
          pendingIncomingCall = null;
        }
        notifyCallState({ status: 'idle', matchId: null });
      });

      call.on('disconnect', () => {
        if (pendingIncomingCall === call) {
          pendingIncomingCall = null;
        }
        if (activeCall === call) {
          activeCall = null;
        }
        notifyCallState({ status: 'idle', matchId: null });
      });
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

export async function ensureDeviceRegistered() {
  return initDevice();
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

export async function acceptIncomingCall() {
  const call = pendingIncomingCall;
  if (!call) return null;

  const meta = extractIncomingMeta(call);
  pendingIncomingCall = null;
  activeCall = call;

  notifyCallState({ status: 'connecting', matchId: meta.matchId });

  try {
    call.accept();
  } catch (e) {
    console.error('[twilioClient] Error accepting incoming call', e);
    activeCall = null;
    notifyCallState({ status: 'error', error: e, matchId: meta.matchId });
    throw e;
  }

  call.on('accept', () => {
    notifyCallState({ status: 'in-call', matchId: meta.matchId });
  });

  call.on('disconnect', () => {
    if (activeCall === call) {
      activeCall = null;
    }
    notifyCallState({ status: 'idle', matchId: null });
  });

  call.on('error', (error) => {
    console.error('[twilioClient] Call error:', error);
    notifyCallState({ status: 'error', error, matchId: meta.matchId });
  });

  return call;
}

export async function rejectIncomingCall() {
  const call = pendingIncomingCall;
  if (!call) return;

  pendingIncomingCall = null;
  try {
    call.reject();
  } catch (e) {
    console.error('[twilioClient] Error rejecting incoming call', e);
  } finally {
    notifyCallState({ status: 'idle', matchId: null });
  }
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
  } else if (pendingIncomingCall) {
    // If ringing, end it.
    await rejectIncomingCall();
  }
}

