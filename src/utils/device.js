export function getDeviceInfo() {
  const ua = navigator.userAgent;
  let os = 'Unknown OS';
  let deviceType = 'desktop';

  if (/android/i.test(ua)) {
    os = 'Android';
    deviceType = 'mobile';
  } else if (/iPad|iPhone|iPod/.test(ua)) {
    os = 'iOS';
    deviceType = 'mobile';
  } else if (/Macintosh|Mac OS X/.test(ua)) {
    os = 'macOS';
  } else if (/Windows NT/.test(ua)) {
    os = 'Windows';
  } else if (/Linux/.test(ua)) {
    os = 'Linux';
  }

  let browser = 'Browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';

  const defaultName = `${os} (${browser})`;

  // Save or retrieve local peer name
  let savedName = localStorage.getItem('quickdrop_device_name');
  if (!savedName) {
    savedName = defaultName;
    localStorage.setItem('quickdrop_device_name', savedName);
  }

  return {
    deviceName: savedName,
    os,
    browser,
    deviceType,
    isMobile: deviceType === 'mobile',
  };
}

export function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSec) {
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatTimeRemaining(seconds) {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return '';
  if (seconds < 60) return `${Math.ceil(seconds)}s left`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `${mins}m ${secs}s left`;
}
