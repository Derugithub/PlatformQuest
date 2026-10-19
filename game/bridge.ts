/** postMessage link to the React Native host (or a parent window when opened in a browser). */

import { parseHostMessage, type GameToHost, type HostToGame } from '../src/core/protocol';

type RnWindow = Window & { ReactNativeWebView?: { postMessage: (data: string) => void } };

export class Bridge {
  private handlers: ((m: HostToGame) => void)[] = [];

  constructor() {
    const onMessage = (event: Event) => {
      if (!(event instanceof MessageEvent)) return;
      const message = parseHostMessage(event.data);
      if (message) this.handlers.forEach((handler) => handler(message));
    };
    window.addEventListener('message', onMessage);
    // Android's WebView delivers host messages on document.
    document.addEventListener('message', onMessage);
  }

  on(handler: (m: HostToGame) => void): void {
    this.handlers.push(handler);
  }

  /** Lets a local test page drive the game the same way the host does. */
  emit(message: HostToGame): void {
    this.handlers.forEach((handler) => handler(message));
  }

  send(message: GameToHost): void {
    const data = JSON.stringify(message);
    const w = window as RnWindow;
    if (w.ReactNativeWebView) w.ReactNativeWebView.postMessage(data);
    else if (window.parent !== window) window.parent.postMessage(data, '*');
    else console.log('[game]', data);
  }
}
