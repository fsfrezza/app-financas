package br.com.frezzatech.financas;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private WebView web;
    private String exportContent;
    private static final String ORIGIN="https://app.frezzatech.local/";
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().setStatusBarColor(Color.rgb(16,42,44));
        getWindow().setNavigationBarColor(Color.WHITE);
        web=new WebView(this);
        web.setBackgroundColor(Color.rgb(244,247,246));
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new Bridge(),"FrezzaNative");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return !r.getUrl().toString().startsWith(ORIGIN);}
            @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){
                Uri uri=r.getUrl();
                if(!"https".equals(uri.getScheme())||!"app.frezzatech.local".equals(uri.getHost()))return blocked();
                String path=uri.getPath();
                if(path==null||path.contains(".."))return blocked();
                if(path.equals("/"))path="/index.html";
                try{String mime=path.endsWith(".js")?"text/javascript":path.endsWith(".css")?"text/css":path.endsWith(".png")?"image/png":path.endsWith(".svg")?"image/svg+xml":path.endsWith(".json")?"application/json":"text/html";
                    return new WebResourceResponse(mime,"UTF-8",getAssets().open(path.substring(1)));
                }catch(Exception ex){return blocked();}
            }
            private WebResourceResponse blocked(){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",java.util.Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
        });
        setContentView(web);
        // Android 15 draws behind system bars; pad using actual system insets.
        web.setOnApplyWindowInsetsListener((v,insets)->{
            if(Build.VERSION.SDK_INT>=30){android.graphics.Insets bars=insets.getInsets(android.view.WindowInsets.Type.systemBars());v.setPadding(bars.left,bars.top,bars.right,bars.bottom);}
            return insets;
        });
        web.loadUrl(ORIGIN);
        ReminderReceiver.schedule(this);
    }
    @Override public void onBackPressed(){web.evaluateJavascript("(()=>{const d=document.querySelector('dialog[open]');if(d){d.close();return true;}return false;})()",result->{if(!"true".equals(result))super.onBackPressed();});}
    @Override protected void onResume(){super.onResume();if(web!=null)web.evaluateJavascript("window.frezzaPermissionChanged&&window.frezzaPermissionChanged()",null);}
    private void message(String text){runOnUiThread(()->Toast.makeText(this,text,Toast.LENGTH_LONG).show());}
    public class Bridge {
        @JavascriptInterface public void setTheme(String mode){
            final boolean dark="dark".equals(mode);
            runOnUiThread(()->{
                int background=dark?Color.rgb(11,23,32):Color.rgb(244,247,246);
                web.setBackgroundColor(background);
                getWindow().setStatusBarColor(background);
                getWindow().setNavigationBarColor(background);
                int flags=dark?0:android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                getWindow().getDecorView().setSystemUiVisibility(flags);
            });
        }
        @JavascriptInterface public void sync(String json){
            if(json.length()>10000000)return;
            try{JSONObject s=new JSONObject(json);if(s.getInt("version")!=1)return;getSharedPreferences("finance",MODE_PRIVATE).edit().putString("reminders",json).apply();ReminderReceiver.schedule(MainActivity.this);}catch(Exception ignored){}
        }
        @JavascriptInterface public boolean notificationsAllowed(){return getSystemService(NotificationManager.class).areNotificationsEnabled();}
        @JavascriptInterface public void requestNotifications(){runOnUiThread(()->{if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},101);});}
        @JavascriptInterface public void exportFile(String name,String content,String mime){
            if(content.length()>10000000){message("Arquivo muito grande.");return;}
            runOnUiThread(()->{exportContent=content;Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType(mime);intent.putExtra(Intent.EXTRA_TITLE,name.replaceAll("[^a-zA-Z0-9._-]","_"));try{startActivityForResult(intent,201);}catch(Exception ex){exportContent=null;message("Não foi possível abrir o seletor de arquivos.");}});
        }
        @JavascriptInterface public void importBackup(){runOnUiThread(()->{Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("application/json");try{startActivityForResult(intent,202);}catch(Exception ex){message("Não foi possível abrir o seletor de arquivos.");}});}
    }
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);if(web!=null)web.evaluateJavascript("window.frezzaPermissionChanged&&window.frezzaPermissionChanged()",null);}
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(result!=RESULT_OK||data==null||data.getData()==null){exportContent=null;return;}
        try{
            if(request==201&&exportContent!=null){try(OutputStream out=getContentResolver().openOutputStream(data.getData())){if(out==null)throw new Exception();out.write(exportContent.getBytes(StandardCharsets.UTF_8));}exportContent=null;message("Arquivo salvo.");}
            else if(request==202){try(InputStream in=getContentResolver().openInputStream(data.getData())){if(in==null)throw new Exception();java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1){if(out.size()+n>10000000)throw new Exception("Limite de 10 MB");out.write(buffer,0,n);}String json=out.toString("UTF-8");web.evaluateJavascript("window.frezzaRestore("+JSONObject.quote(json)+")",null);}}
        }catch(Exception ex){exportContent=null;message("Não foi possível ler ou salvar o arquivo.");}
    }
}
