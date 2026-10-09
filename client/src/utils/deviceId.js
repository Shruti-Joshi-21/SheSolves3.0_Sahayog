// Stable per-browser id sent with check-in/out so the server can spot shared-device (proxy) attendance.
const KEY = 'sahayog_device_id';

function randomId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getDeviceId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

// Appends deviceId + userAgent to a check-in/out FormData
export function appendDeviceInfo(formData) {
  const deviceId = getDeviceId();
  if (deviceId) formData.append('deviceId', deviceId);
  formData.append('userAgent', navigator.userAgent || '');
}
