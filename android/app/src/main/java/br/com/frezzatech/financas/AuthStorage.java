package br.com.frezzatech.financas;
import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import java.nio.charset.StandardCharsets;
final class AuthStorage {
 private static final String ALIAS="frezzatech-auth-v1";
 private static synchronized SecretKey key()throws Exception {
  KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
  if(store.containsAlias(ALIAS))return (SecretKey)store.getKey(ALIAS,null);
  KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
  generator.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());return generator.generateKey();
 }
 static String get(Context c,String name){if(!name.startsWith("frezzatech.auth.v1"))return null;try{
  String raw=c.getSharedPreferences("auth",0).getString(name,null);if(raw==null)return null;String[] parts=raw.split(":");
  Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));
  return new String(cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),StandardCharsets.UTF_8);
 }catch(Exception ex){throw new IllegalStateException("Não foi possível recuperar a sessão. Entre novamente.");}}
 static void set(Context c,String name,String value){if(!name.startsWith("frezzatech.auth.v1")||value.length()>100000)return;try{
  Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());
  String encrypted=Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP);
  if(!c.getSharedPreferences("auth",0).edit().putString(name,encrypted).commit())throw new Exception();
 }catch(Exception ex){throw new IllegalStateException("Não foi possível salvar a sessão com segurança.");}}
 static void remove(Context c,String name){if(name.startsWith("frezzatech.auth.v1"))c.getSharedPreferences("auth",0).edit().remove(name).commit();}
}
