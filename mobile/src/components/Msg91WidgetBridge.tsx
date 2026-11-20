/**
 * Msg91WidgetBridge — runs the official MSG91 OTP Widget SDK inside a hidden
 * WebView and exposes its send/verify/retry methods to React Native.
 *
 * Why a WebView? Both MSG91 widgets used by this project have hCaptcha enabled.
 * The JS SDK renders an invisible hCaptcha and sends the resulting `token`
 * with every send/retry request. A plain `fetch()` cannot create that token,
 * which is why direct REST calls returned "Invalid Captcha Token" even with
 * credentials that work in the browser projects.
 *
 * This mirrors those projects exactly:
 *   initSendOTP({ widgetId, tokenAuth, exposeMethods: true, ... })
 *   sendOtp(identifier, success, failure)
 *   verifyOtp(otp, success, failure, requestId?)
 *   retryOtp(channel, success, failure, requestId?)
 *
 * react-native-webview is bundled with Expo Go, so this keeps the current
 * `npx expo start -c` + Expo Go workflow.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

/** Only the imperative method the bridge needs — avoids WebView's generic ref typing. */
type WebViewHandle = { injectJavaScript: (script: string) => void };

/* ─────────────────────────── Bridge protocol ───────────────────────────── */

type WidgetCommand = 'sendOtp' | 'verifyOtp' | 'retryOtp';

interface BridgeMessage {
  type:
    | 'ready'
    | 'error'
    | 'sendOtpResult'
    | 'verifyOtpResult'
    | 'retryOtpResult'
    | 'authSuccess'
    | 'authFailure';
  id?: string;
  ok?: boolean;
  data?: unknown;
  error?: unknown;
}

interface PendingCall {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const errorMessage = (value: unknown): string => {
  if (typeof value === 'string' && value.trim()) return value.slice(0, 300);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const first = Array.isArray(obj.errors) ? obj.errors[0] : undefined;
    if (typeof first === 'string') return first.slice(0, 300);
    if (typeof obj.message === 'string') return obj.message.slice(0, 300);
    if (typeof obj.error === 'string') return obj.error.slice(0, 300);
  }
  return 'MSG91 OTP request failed. Please try again.';
};

/** The SDK returns the reqId in `message` (or in `data`), depending on version. */
const extractRequestId = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  const data =
    obj.data && typeof obj.data === 'object'
      ? (obj.data as Record<string, unknown>)
      : obj;
  for (const key of ['message', 'request_id', 'requestId', 'reqId']) {
    const candidate = data[key];
    if (typeof candidate === 'string' && /^[A-Za-z0-9_-]{6,}$/.test(candidate)) {
      return candidate;
    }
  }
  return null;
};

class Msg91WidgetBridgeController {
  private webView: WebViewHandle | null = null;
  private ready = false;
  private initError: string | null = null;
  private requestId: string | null = null;
  private pending = new Map<string, PendingCall>();
  private waiters: PendingCall[] = [];
  private seq = 0;

  attach(webView: WebViewHandle | null): void {
    this.webView = webView;
    this.ready = false;
    this.initError = null;
  }

  handleMessage(message: BridgeMessage): void {
    if (message.type === 'ready') {
      this.ready = true;
      this.initError = null;
      this.flushWaiters();
      return;
    }
    if (message.type === 'error') {
      this.initError = errorMessage(message.error);
      this.ready = false;
      this.rejectWaiters(new Error(this.initError));
      return;
    }
    if (message.type === 'authFailure') {
      console.warn('[MSG91 Bridge] SDK failure:', errorMessage(message.error));
      return;
    }
    if (!message.id || !message.type.endsWith('Result')) return;

    const call = this.pending.get(message.id);
    if (!call) return;
    this.pending.delete(message.id);
    clearTimeout(call.timer);

    if (message.ok) {
      if (message.type === 'sendOtpResult') {
        this.requestId = extractRequestId(message.data);
      }
      call.resolve(message.data);
    } else {
      call.reject(new Error(errorMessage(message.error ?? message.data)));
    }
  }

  private flushWaiters(): void {
    const waiters = this.waiters.splice(0);
    for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      waiter.resolve(undefined);
    }
  }

  private rejectWaiters(error: Error): void {
    const waiters = this.waiters.splice(0);
    for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
  }

  private waitForReady(timeoutMs = 20000): Promise<void> {
    if (this.ready && this.webView) return Promise.resolve();
    if (this.initError) return Promise.reject(new Error(this.initError));
    return new Promise<void>((resolve, reject) => {
      const waiter: PendingCall = {
        resolve,
        reject,
        timer: setTimeout(() => {
          this.waiters = this.waiters.filter((entry) => entry !== waiter);
          reject(
            new Error(
              'MSG91 OTP service did not load. Check your internet connection and reload the app.',
            ),
          );
        }, timeoutMs),
      };
      this.waiters.push(waiter);
    });
  }

  async call(
    command: WidgetCommand,
    args: Record<string, unknown>,
    timeoutMs = 30000,
  ): Promise<any> {
    await this.waitForReady();
    const webView = this.webView;
    if (!webView) throw new Error('MSG91 OTP service is not available. Reload the app.');

    const id = `${command}_${++this.seq}`;
    const payload =
      command === 'verifyOtp' || command === 'retryOtp'
        ? { command, id, ...args, requestId: this.requestId ?? undefined }
        : { command, id, ...args };

    return new Promise<any>((resolve, reject) => {
      const call: PendingCall = {
        resolve,
        reject,
        timer: setTimeout(() => {
          this.pending.delete(id);
          reject(new Error('MSG91 did not respond. Please try again.'));
        }, timeoutMs),
      };
      this.pending.set(id, call);
      try {
        webView.injectJavaScript(
          `window.__msg91BridgeCall(${JSON.stringify(payload)}); true;`,
        );
      } catch (error) {
        clearTimeout(call.timer);
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  reset(): void {
    this.webView = null;
    this.ready = false;
    this.initError = null;
    this.requestId = null;
    for (const call of this.pending.values()) {
      clearTimeout(call.timer);
      call.reject(new Error('OTP service closed. Please try again.'));
    }
    this.pending.clear();
    this.rejectWaiters(new Error('OTP service closed. Please try again.'));
  }
}

export const msg91WidgetBridge = new Msg91WidgetBridgeController();

/* ───────────────────────────── Web page ────────────────────────────────── */

const WIDGET_SCRIPTS = [
  'https://verify.msg91.com/otp-provider.js',
  'https://verify.phone91.com/otp-provider.js',
];

const buildWidgetHtml = (widgetId: string, tokenAuth: string): string => {
  const config = JSON.stringify({ widgetId, tokenAuth }).replace(/</g, '\\u003c');
  const scripts = JSON.stringify(WIDGET_SCRIPTS);
  return `<!doctype html>
<html>
  <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body>
    <script>
      (function () {
        var config = ${config};
        var scripts = ${scripts};

        function post(payload) {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          }
        }

        function serialize(value) {
          if (value === undefined || value === null) return null;
          if (value instanceof Error) return { message: value.message || String(value) };
          if (typeof value !== 'object') return { message: String(value) };
          try { return JSON.parse(JSON.stringify(value)); } catch (error) { return { message: String(value) }; }
        }

        function fail(error) {
          post({ type: 'error', error: serialize(error) });
        }

        function loadScript(index) {
          if (index >= scripts.length) {
            fail('Could not load the MSG91 OTP script. Check your internet connection.');
            return;
          }
          var script = document.createElement('script');
          script.src = scripts[index];
          script.async = true;
          script.onload = function () {
            if (typeof window.initSendOTP !== 'function') {
              loadScript(index + 1);
              return;
            }
            try {
              window.initSendOTP({
                widgetId: config.widgetId,
                tokenAuth: config.tokenAuth,
                exposeMethods: true,
                success: function (data) { post({ type: 'authSuccess', data: serialize(data) }); },
                failure: function (error) { post({ type: 'authFailure', error: serialize(error) }); }
              });
            } catch (error) {
              fail(error);
              return;
            }

            // The SDK exposes its methods before hCaptcha finishes rendering.
            // Sending too early makes getToken() return {pending:true} and the
            // SDK silently drops the request, so wait for the captcha iframe.
            var waited = 0;
            var dataSeenAt = 0;
            var captchaRendered = function (data) {
              if (!data || !data.captchaValidations) return true;
              var hosts = [];
              var byId = document.getElementById('captcha-container');
              if (byId) hosts.push(byId);
              var widget = document.querySelector('msg91-otp-provider');
              if (widget && widget.shadowRoot) {
                var host = widget.shadowRoot.querySelector('#captcha-container');
                if (host) hosts.push(host);
              }
              var detached = document.querySelector('.msg91-hcaptcha-invisible');
              if (detached) hosts.push(detached);
              for (var i = 0; i < hosts.length; i++) {
                if (hosts[i].querySelector('iframe')) return true;
              }
              return document.querySelectorAll('iframe[src*="hcaptcha"]').length > 0;
            };
            var poll = setInterval(function () {
              waited += 100;
              var methodsReady =
                typeof window.sendOtp === 'function' &&
                typeof window.verifyOtp === 'function' &&
                typeof window.retryOtp === 'function';
              var data = typeof window.getWidgetData === 'function' ? window.getWidgetData() : null;
              if (data && !data.type && !dataSeenAt) dataSeenAt = waited;

              if (methodsReady && dataSeenAt && captchaRendered(data)) {
                clearInterval(poll);
                post({ type: 'ready' });
              } else if (waited >= 20000) {
                clearInterval(poll);
                fail('MSG91 OTP widget did not initialize. Check the MSG91 widget ID and your connection.');
              }
            }, 100);
          };
          script.onerror = function () { loadScript(index + 1); };
          document.head.appendChild(script);
        }

        // Called from React Native via WebView.injectJavaScript().
        window.__msg91BridgeCall = function (message) {
          if (!message || !message.command) return;
          var callback = function (ok) {
            return function (value) {
              var result = { type: message.command + 'Result', id: message.id, ok: ok };
              if (ok) result.data = serialize(value);
              else result.error = serialize(value);
              post(result);
            };
          };

          try {
            if (message.command === 'sendOtp') {
              window.sendOtp(message.identifier, callback(true), callback(false));
            } else if (message.command === 'verifyOtp') {
              window.verifyOtp(message.otp, callback(true), callback(false), message.requestId);
            } else if (message.command === 'retryOtp') {
              window.retryOtp(message.channel || null, callback(true), callback(false), message.requestId);
            }
          } catch (error) {
            post({ type: message.command + 'Result', id: message.id, ok: false, error: serialize(error) });
          }
        };

        loadScript(0);
      })();
    </script>
  </body>
</html>`;
};

/* ───────────────────────────── Component ───────────────────────────────── */

export default function Msg91WidgetBridge() {
  const widgetId =
    process.env.EXPO_PUBLIC_MSG91_WIDGET_ID?.trim() ||
    process.env.EXPO_PUBLIC_MSG91_TEMPLATE_ID?.trim() ||
    '';
  const tokenAuth =
    process.env.EXPO_PUBLIC_MSG91_TOKEN_AUTH?.trim() ||
    process.env.EXPO_PUBLIC_MSG91_AUTH_KEY?.trim() ||
    '';

  const html = useMemo(
    () => (widgetId && tokenAuth ? buildWidgetHtml(widgetId, tokenAuth) : ''),
    [widgetId, tokenAuth],
  );
  const webViewRef = useRef<WebViewHandle>(null);

  useEffect(() => {
    if (!html) return;
    msg91WidgetBridge.attach(webViewRef.current);
    return () => msg91WidgetBridge.reset();
  }, [html]);

  if (!html) return null;

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      msg91WidgetBridge.handleMessage(JSON.parse(event.nativeEvent.data) as BridgeMessage);
    } catch (error) {
      console.warn('[MSG91 Bridge] Ignored malformed message:', error);
    }
  };

  return (
    <View
      style={styles.hidden}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
    >
      <WebView
        ref={webViewRef as any}
        source={{ html, baseUrl: 'https://verify.msg91.com/' }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
        style={styles.webView}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
  webView: {
    width: 1,
    height: 1,
    backgroundColor: 'transparent',
  },
});
