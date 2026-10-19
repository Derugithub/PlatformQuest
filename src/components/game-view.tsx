import { forwardRef, memo, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { parseGameMessage, type GameToHost, type HostToGame } from '@/core/protocol';
import { GAME_HTML } from '@/game-html/game-html';

export type GameViewHandle = { send: (message: HostToGame) => void };

/**
 * The Phaser game, bundled into one offline HTML page (scripts/build-game.mjs) and loaded from the
 * app bundle. Nothing is fetched from the network.
 */
export const GameView = memo(
  forwardRef<GameViewHandle, { onMessage: (message: GameToHost) => void }>(function GameView({ onMessage }, ref) {
    const webRef = useRef<WebView>(null);
    const source = useMemo(() => ({ html: GAME_HTML, baseUrl: '' }), []);
    useImperativeHandle(ref, () => ({
      send: (message: HostToGame) => webRef.current?.postMessage(JSON.stringify(message)),
    }));
    return (
      <WebView
        ref={webRef}
        source={source}
        originWhitelist={['*']}
        style={styles.web}
        containerStyle={styles.web}
        onMessage={(event: WebViewMessageEvent) => {
          const message = parseGameMessage(event.nativeEvent.data);
          if (message) onMessage(message);
        }}
        javaScriptEnabled
        domStorageEnabled={false}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        scrollEnabled={false}
        overScrollMode="never"
        bounces={false}
        setBuiltInZoomControls={false}
        androidLayerType="hardware"
        textZoom={100}
        cacheEnabled={false}
        allowFileAccess={false}
        setSupportMultipleWindows={false}
        webviewDebuggingEnabled={__DEV__}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      />
    );
  }),
);

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: '#0f172a' },
});
