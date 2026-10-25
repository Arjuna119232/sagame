package com.karta.sagame;
import android.app.Activity;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.webkit.WebViewAssetLoader;
public class MainActivity extends Activity {
  WebView w;
  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
        .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
    w = new WebView(this);
    WebSettings s = w.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setMediaPlaybackRequiresUserGesture(false);
    w.setWebViewClient(new WebViewClient() {
      @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
        return loader.shouldInterceptRequest(r.getUrl());
      }
    });
    w.addJavascriptInterface(new Object() {
      @JavascriptInterface public void quit() { runOnUiThread(new Runnable() { public void run() { finish(); } }); }
    }, "Android");
    w.setBackgroundColor(0xff000000);
    setContentView(w);
    w.loadUrl("https://appassets.androidplatform.net/assets/index.html");
  }
  @Override protected void onPause() { super.onPause(); w.onPause(); }
  @Override protected void onResume() { super.onResume(); w.onResume(); }
  @Override public void onBackPressed() { w.evaluateJavascript("window.bk&&bk()", null); }
}
