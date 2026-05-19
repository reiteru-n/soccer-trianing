package com.soccer.training;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private static final String START_URL = "https://soccer-trianing.vercel.app/";
    private static final String APP_HOST = "soccer-trianing.vercel.app";
    private static final String[] EXTERNAL_HOSTS = {
        "youtube.com", "youtu.be", "m.youtube.com",
        "www.youtube.com", "music.youtube.com"
    };

    private WebView webView;
    private boolean clearHistoryOnNextLoad = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        webView.setBackgroundColor(0xff0f172a); // 黒っぽい背景で起動時の白フラッシュ防止
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportMultipleWindows(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setNeedInitialFocus(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (isExternal(uri)) {
                    openExternal(view, uri);
                    return true;
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (clearHistoryOnNextLoad) {
                    view.clearHistory();
                    clearHistoryOnNextLoad = false;
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                // target="_blank" の URL を取得するため一時 WebView を作って捕まえる
                final WebView captureView = new WebView(view.getContext());
                captureView.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                        openExternal(view, req.getUrl());
                        v.destroy();
                        return true;
                    }
                });
                ((WebView.WebViewTransport) resultMsg.obj).setWebView(captureView);
                resultMsg.sendToTarget();
                return true;
            }
        });

        webView.requestFocus(View.FOCUS_DOWN);
        webView.loadUrl(START_URL);
    }

    private boolean isExternal(Uri uri) {
        if (uri == null || uri.getHost() == null) return false;
        String host = uri.getHost().toLowerCase();
        if (host.equals(APP_HOST)) return false;
        for (String ext : EXTERNAL_HOSTS) {
            if (host.equals(ext) || host.endsWith("." + ext)) return true;
        }
        return false;
    }

    private void openExternal(WebView fallbackView, Uri uri) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, uri);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            // 外部アプリ無し → WebView内で開く
            if (fallbackView != null) fallbackView.loadUrl(uri.toString());
        } catch (Exception e) {
            // 想定外
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Cookie を確実にディスクへ
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
