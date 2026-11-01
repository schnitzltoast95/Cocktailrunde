package app.friends.cocktails;

import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "BugReport")
public class BugReportPlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void isConfigured(PluginCall call) {
        JSObject result = new JSObject();
        result.put("configured", !getContext().getString(R.string.bug_report_token).isEmpty());
        call.resolve(result);
    }

    @PluginMethod
    public void submit(PluginCall call) {
        String title = call.getString("title", "").trim();
        String description = call.getString("description", "").trim();
        if (title.isEmpty() || title.length() > 120 || description.isEmpty() || description.length() > 5000) {
            call.reject("Title or description is invalid");
            return;
        }
        String token = getContext().getString(R.string.bug_report_token);
        if (token.isEmpty()) {
            call.reject("Bug reporting is not configured");
            return;
        }
        JSObject context = call.getObject("context", new JSObject());
        executor.execute(() -> {
            HttpURLConnection connection = null;
            try {
                String body = buildBody(description, context);
                JSONObject payload = new JSONObject()
                    .put("title", "[App-Fehler] " + title)
                    .put("body", body);
                connection = (HttpURLConnection) new URL("https://api.github.com/repos/schnitzltoast95/Cocktailrunde/issues").openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(15_000);
                connection.setReadTimeout(15_000);
                connection.setDoOutput(true);
                connection.setRequestProperty("Accept", "application/vnd.github+json");
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                connection.setRequestProperty("X-GitHub-Api-Version", "2022-11-28");
                connection.setRequestProperty("Authorization", "Bearer " + token);
                try (OutputStream out = connection.getOutputStream()) {
                    out.write(payload.toString().getBytes(StandardCharsets.UTF_8));
                }
                if (connection.getResponseCode() != HttpURLConnection.HTTP_CREATED) {
                    throw new IllegalStateException("GitHub returned HTTP " + connection.getResponseCode());
                }
                String response;
                try (InputStream input = connection.getInputStream(); ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
                    byte[] chunk = new byte[4096];
                    int count;
                    while ((count = input.read(chunk)) != -1) buffer.write(chunk, 0, count);
                    response = new String(buffer.toByteArray(), StandardCharsets.UTF_8);
                }
                JSObject result = new JSObject();
                result.put("url", new JSONObject(response).getString("html_url"));
                call.resolve(result);
            } catch (Exception error) {
                call.reject("Issue creation failed", error);
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    private String buildBody(String description, JSObject context) throws Exception {
        StringBuilder body = new StringBuilder("<!-- cocktailrunde-app-bug-report:v1 -->\n## Bericht\n")
            .append(description).append("\n\n## App-Informationen\n")
            .append("- Aktuelle Ansicht: ").append(context.optString("screen", "Unbekannt")).append('\n');
        JSONArray screens = context.optJSONArray("recentScreens");
        if (screens != null) {
            StringBuilder trail = new StringBuilder();
            for (int i = Math.max(0, screens.length() - 6); i < screens.length(); i++) {
                if (trail.length() > 0) trail.append(" → ");
                trail.append(screens.optString(i));
            }
            body.append("- Letzte Ansichten: ").append(trail).append('\n');
        }
        String drink = context.optString("drink", "");
        if (!drink.isEmpty() && !"null".equals(drink)) body.append("- Cocktail: ").append(drink).append('\n');
        String version = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0).versionName;
        body.append("- App-Version: ").append(version).append('\n')
            .append("- Android: ").append(Build.VERSION.RELEASE).append(" (API ").append(Build.VERSION.SDK_INT).append(")\n")
            .append("- Gerät: ").append(Build.MANUFACTURER).append(' ').append(Build.MODEL).append("\n\n")
            .append("_Aus der App gemeldet; ohne GitHub-Konto der meldenden Person._");
        return body.toString();
    }

    @Override
    protected void handleOnDestroy() {
        executor.shutdownNow();
        super.handleOnDestroy();
    }
}
