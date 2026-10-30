// Shared, counted page-scroll lock. Several components can hold a lock at once
// (loader, hero intro); the page unlocks only when every lock is released.
// (Saving/restoring `overflow` per component breaks when locks overlap.)
let locks = 0;

export function lockScroll() {
  locks += 1;
  if (locks === 1) {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }
  let released = false;
  return function unlockScroll() {
    if (released) return;
    released = true;
    locks -= 1;
    if (locks === 0) {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
  };
}
