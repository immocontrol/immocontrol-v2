/**
 * AppLayout scrollt den Seiteninhalt in #main-content (overflow-y-auto), nicht am window.
 * Hilfsfunktionen — gleiche Logik wie BackToTop, damit Scroll-Position und Navigation konsistent sind.
 */
export function getAppScrollContainer(): HTMLElement | typeof window {
  const main = document.getElementById("main-content");
  if (main && main.scrollHeight > main.clientHeight) return main;
  return window;
}

export function getAppScrollTop(): number {
  const c = getAppScrollContainer();
  return c === window ? window.scrollY : (c as HTMLElement).scrollTop;
}

/** Maximale Scroll-Strecke des aktiven Containers (0 wenn nicht scrollbar). */
export function getAppScrollRange(): number {
  const c = getAppScrollContainer();
  if (c === window) {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }
  const el = c as HTMLElement;
  return Math.max(0, el.scrollHeight - el.clientHeight);
}

export function appScrollTo(top: number, behavior: ScrollBehavior = "instant") {
  const c = getAppScrollContainer();
  if (c === window) {
    window.scrollTo({ top, behavior });
  } else {
    (c as HTMLElement).scrollTo({ top, behavior });
  }
}
