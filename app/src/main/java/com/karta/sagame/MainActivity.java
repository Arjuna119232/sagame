package com.karta.sagame;
import android.app.Activity;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.JavascriptInterface;
public class MainActivity extends Activity {
  WebView w;
  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    w = new WebView(this);
    WebSettings s = w.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setMediaPlaybackRequiresUserGesture(false);
    w.addJavascriptInterface(new Object() {
      @JavascriptInterface public void quit() { runOnUiThread(new Runnable() { public void run() { finish(); } }); }
    }, "Android");
    w.setBackgroundColor(0xff000000);
    setContentView(w);
    w.loadUrl("file:///android_asset/index.html");
  }
  @Override protected void onPause() { super.onPause(); w.onPause(); }
  @Override protected void onResume() { super.onResume(); w.onResume(); }
  @Override public void onBackPressed() { w.evaluateJavascript("window.bk&&bk()", null); }
}
