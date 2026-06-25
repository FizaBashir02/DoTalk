package com.dotalk.app;

import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        try {
            WebView webView = this.getBridge().getWebView();
            if (webView != null && this.getBridge() != null) {
                webView.setWebViewClient(new BridgeWebViewClient(this.getBridge()) {
                    @Override
                    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                        if (request != null && request.getUrl() != null) {
                            String url = request.getUrl().toString();
                            Log.d("DOTALK", "Capacitor Intercept URL: " + url);
                            Log.d("DOTALK", "REQUEST URL=" + url);
                        }
                        return super.shouldInterceptRequest(view, request);
                    }
                });
                Log.d("DOTALK", "Successfully registered custom BridgeWebViewClient interceptor");
            }
        } catch (Exception e) {
            Log.e("DOTALK", "Failed to set custom BridgeWebViewClient", e);
        }
    }
}

