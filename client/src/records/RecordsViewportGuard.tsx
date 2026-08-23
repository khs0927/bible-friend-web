import { useEffect } from 'react';

/*
 * Mobile Safari can preserve scrollTop when the Records panel swaps screens.
 * Keep one observer per live .records-main, reset only on direct child swaps,
 * and disconnect observers as soon as their target leaves the document.
 */
export default function RecordsViewportGuard() {
  useEffect(() => {
    const observers = new Map<Element, MutationObserver>();

    const detachRemovedTargets = () => {
      observers.forEach((observer, target) => {
        if (document.contains(target)) return;
        observer.disconnect();
        observers.delete(target);
      });
    };

    const attach = (main: Element) => {
      if (observers.has(main)) return;
      const element = main as HTMLElement;
      element.scrollTop = 0;

      const observer = new MutationObserver(mutations => {
        if (!mutations.some(mutation => mutation.type === 'childList')) return;
        requestAnimationFrame(() => {
          if (!document.contains(element)) return;
          element.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        });
      });

      observer.observe(main, { childList: true });
      observers.set(main, observer);
    };

    const scan = () => {
      detachRemovedTargets();
      document.querySelectorAll('.records-main').forEach(attach);
    };

    scan();

    const rootObserver = new MutationObserver(scan);
    rootObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      rootObserver.disconnect();
      observers.forEach(observer => observer.disconnect());
      observers.clear();
    };
  }, []);

  return null;
}
