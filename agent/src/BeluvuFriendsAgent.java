import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.lang.instrument.Instrumentation;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Агент «Друзья в игре». Лаунчер запускает игру с -javaagent и передаёт путь к конфигу.
 * Сейчас это заглушка: поднимает локальный канал на 127.0.0.1 с токеном и отвечает на приветствие.
 * Отрисовки (Shift+Tab) здесь пока нет.
 */
public final class BeluvuFriendsAgent {
    public static final String VERSION = "0.1-stub";

    public static void premain(String args, Instrumentation inst) {
        try {
            if (args == null || args.isEmpty()) {
                log("no config, exiting");
                return;
            }
            String json = new String(Files.readAllBytes(Paths.get(args)), StandardCharsets.UTF_8);
            int port = intField(json, "port");
            String token = stringField(json, "token");
            if (port <= 0 || token == null || token.length() < 16) {
                log("bad config");
                return;
            }
            Thread t = new Thread(() -> serve(port, token), "beluvu-friends");
            t.setDaemon(true);
            t.start();
        } catch (Exception e) {
            log("failed to start: " + e);
        }
    }

    private static void serve(int port, String token) {
        try (ServerSocket server = new ServerSocket(port, 8, InetAddress.getByName("127.0.0.1"))) {
            log("listening on 127.0.0.1:" + port);
            while (!server.isClosed()) {
                Socket s = server.accept();
                handle(s, token);
            }
        } catch (Exception e) {
            log("channel stopped: " + e);
        }
    }

    private static void handle(Socket s, String token) {
        try (Socket sock = s) {
            sock.setSoTimeout(3000);
            BufferedReader in = new BufferedReader(new InputStreamReader(sock.getInputStream(), StandardCharsets.UTF_8));
            String line = in.readLine();
            Writer out = new OutputStreamWriter(sock.getOutputStream(), StandardCharsets.UTF_8);
            if (line == null || !token.equals(stringField(line, "token"))) {
                out.write("{\"ok\":false,\"error\":\"bad token\"}\n");
            } else {
                out.write("{\"ok\":true,\"agent\":\"" + VERSION + "\"}\n");
            }
            out.flush();
        } catch (Exception ignored) {
            // плохой или оборванный запрос просто закрываем
        }
    }

    private static int intField(String json, String name) {
        Matcher m = Pattern.compile("\"" + name + "\"\\s*:\\s*(\\d+)").matcher(json);
        return m.find() ? Integer.parseInt(m.group(1)) : -1;
    }

    private static String stringField(String json, String name) {
        Matcher m = Pattern.compile("\"" + name + "\"\\s*:\\s*\"([^\"]*)\"").matcher(json);
        return m.find() ? m.group(1) : null;
    }

    private static void log(String text) {
        System.err.println("[BeluvuFriends] " + text);
    }
}
