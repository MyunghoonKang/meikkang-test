import { useEffect, useRef, type RefObject } from 'react';
import { z } from 'zod';
import { HostToIframe, IframeToHost } from '../../shared/protocol';

type Outbound = z.infer<typeof HostToIframe>;
type Inbound = z.infer<typeof IframeToHost>;

export function useGameFrame(iframe: RefObject<HTMLIFrameElement | null>, onMessage: (msg: Inbound) => void) {
  const onMsgRef = useRef(onMessage);
  onMsgRef.current = onMessage;

  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.source !== iframe.current?.contentWindow) return;
      const parsed = IframeToHost.safeParse(e.data);
      if (!parsed.success) return console.warn('iframe msg rejected', e.data);
      onMsgRef.current(parsed.data);
    };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, [iframe]);

  const send = (msg: Outbound) => iframe.current?.contentWindow?.postMessage(msg, '*');
  return { send };
}
