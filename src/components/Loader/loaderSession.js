// "Show once per session" flag. sessionStorage can throw (private mode, blocked
// storage), in which case we simply show the loader.
const SESSION_KEY = 'slate-loader:seen';

export function shouldShowLoader() {
  try {
    return sessionStorage.getItem(SESSION_KEY) !== '1';
  } catch {
    return true;
  }
}

export function markLoaderSeen() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    /* ignore */
  }
}
