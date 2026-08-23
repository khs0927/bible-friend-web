import { useEffect } from 'react';

/*
 * The records panel swaps its direct screen sections in-place. Mobile Safari
 * preserves the previous scrollTop for the scroll container, which can make a
 * newly selected Prayer / Verse hero look vertically sliced. Watch only direct
 * children of records-main so internal list updates do not disturb scrolling.
 */
export default function RecordsViewportGuard() {
  useEffect(() => {
    const attached = new WeakSet<Element>();
    const localObservers = new Set<MutationObserver>();

    const attach = (main: Element) => {
      if (attached.has(main)) return;
      attached.add(main);
      const element = main as HTMLElement;
      element.scrollTop = 0;
      const observer = new MutationObserver(mutations => {
        if (!mutations.some(mutation => mutation.type === 'childList')) return;
        requestAnimationFrame(() => {
          element.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        });
      });
      observer.observe(main, { childList: true });
      localObservers.add(observer);
    };

    const scan = () => document.querySelectorAll('.records-main').forEach(attach);
    scan();

    const rootObserver = new MutationObserver(scan);
    rootObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      rootObserver.disconnect();
      localObservers.forEach(observer => observer.disconnect());
      localObservers.clear();
    };
  }, []);

  return null;
}
