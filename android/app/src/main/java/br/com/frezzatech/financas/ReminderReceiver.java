package br.com.frezzatech.financas;
import android.app.*;
import android.content.*;
import android.os.Build;
import org.json.*;
import java.time.*;
import java.time.temporal.ChronoUnit;

public class ReminderReceiver extends BroadcastReceiver {
    static final String CHANNEL="financial_reminders";
    static JSONObject data(Context context){try{return new JSONObject(context.getSharedPreferences("finance",Context.MODE_PRIVATE).getString("reminders","{}"));}catch(Exception ex){return new JSONObject();}}
    static PendingIntent pending(Context c){return PendingIntent.getBroadcast(c,1,new Intent(c,ReminderReceiver.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
    public static void schedule(Context c){
        AlarmManager manager=c.getSystemService(AlarmManager.class);
        manager.cancel(pending(c));
        JSONObject s=data(c);if(s.optJSONObject("settings")==null||!s.optJSONObject("settings").optBoolean("notifications",false))return;
        ZonedDateTime next=ZonedDateTime.now().withHour(9).withMinute(0).withSecond(0).withNano(0);if(!next.isAfter(ZonedDateTime.now()))next=next.plusDays(1);
        manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,next.toInstant().toEpochMilli(),pending(c));
    }
    public static String reminderBody(JSONObject s,LocalDate now)throws Exception {
        JSONObject settings=s.optJSONObject("settings");if(settings==null||!settings.optBoolean("notifications"))return null;
        int overdue=0,soon=0,income=0,supplies=0,lead=settings.optInt("leadDays",3);
        JSONArray tx=s.optJSONArray("transactions");
        if(tx!=null)for(int i=0;i<tx.length();i++){JSONObject t=tx.getJSONObject(i);if(!t.isNull("paidDate")&&!t.optString("paidDate").isEmpty()||t.has("transferId"))continue;if("income".equals(t.optString("type"))){if(settings.optBoolean("incomeReminders",false)&&ChronoUnit.DAYS.between(now,LocalDate.parse(t.getString("dueDate")))<=lead)income++;continue;}LocalDate due=LocalDate.parse(t.getString("dueDate"));long days=ChronoUnit.DAYS.between(now,due);if(days<0)overdue++;else if(days<=lead)soon++;}
        JSONArray items=s.optJSONArray("consumables");
        if(items!=null)for(int i=0;i<items.length();i++){JSONObject item=items.getJSONObject(i);JSONArray records=item.getJSONArray("records");if(records.length()==0)continue;java.util.List<LocalDate> dates=new java.util.ArrayList<>();for(int j=0;j<records.length();j++)dates.add(LocalDate.parse(records.getString(j)));java.util.Collections.sort(dates);long average=dates.size()>1?Math.round((double)ChronoUnit.DAYS.between(dates.get(0),dates.get(dates.size()-1))/(dates.size()-1)):item.optInt("initialDays",60);LocalDate next=dates.get(dates.size()-1).plusDays(average);if(ChronoUnit.DAYS.between(now,next)<=item.optInt("leadDays",7))supplies++;}
        if(overdue+soon+income+supplies==0)return null;
        return overdue+" vencida(s), "+soon+" próxima(s) do vencimento, "+income+" entrada(s) prevista(s)/atrasada(s) e "+supplies+" reposição(ões) estimada(s). Abra o app para conferir.";
    }
    @Override public void onReceive(Context c,Intent intent){
        try{String text=reminderBody(data(c),LocalDate.now());NotificationManager manager=c.getSystemService(NotificationManager.class);
            if(text!=null&&manager.areNotificationsEnabled()){
                manager.createNotificationChannel(new NotificationChannel(CHANNEL,"Lembretes financeiros",NotificationManager.IMPORTANCE_DEFAULT));
                PendingIntent open=PendingIntent.getActivity(c,2,new Intent(c,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
                Notification notification=new Notification.Builder(c,CHANNEL).setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("Frezzatech · Seu resumo do dia").setContentText(text).setStyle(new Notification.BigTextStyle().bigText(text)).setContentIntent(open).setAutoCancel(true).setVisibility(Notification.VISIBILITY_PRIVATE).build();
                manager.notify(1,notification);
            }
        }catch(Exception ignored){}finally{schedule(c);}
    }
}
