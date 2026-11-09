package com.servicesvales.local;

import java.io.IOException;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/** Aísla PostgreSQL de desarrollo de las instancias y bases ajenas al proyecto. */
public final class BaseLocal implements AutoCloseable {
    private static final String OWNER = "vales_owner";
    private static final boolean WINDOWS = System.getProperty("os.name").startsWith("Windows");
    private final Path home;
    private final Path data;
    private final Path bin;
    private final FileChannel lockChannel;
    private final FileLock lock;
    private final int dbPort;
    private boolean started;

    private BaseLocal(Path home, FileChannel lockChannel, FileLock lock) throws IOException {
        this.home = home;
        this.data = home.resolve("postgres");
        this.bin = detectarPostgres(data);
        this.lockChannel = lockChannel;
        this.lock = lock;
        this.dbPort = EntornoLocal.puertoLibre(0);
    }

    public static BaseLocal iniciar(Path home) throws Exception {
        Files.createDirectories(home);
        FileChannel channel = FileChannel.open(home.resolve("ejecucion.lock"),
                StandardOpenOption.CREATE, StandardOpenOption.WRITE);
        FileLock lock = null;
        BaseLocal base = null;
        try {
            lock = channel.tryLock();
            if (lock == null) throw new IOException("Ya hay otra instancia de Services Vales usando " + home);
            base = new BaseLocal(home, channel, lock);
            base.arrancarPostgres();
            return base;
        } catch (Exception error) {
            if (base != null) base.close();
            else {
                if (lock != null) lock.release();
                channel.close();
            }
            throw error;
        }
    }

    private void arrancarPostgres() throws Exception {
        Path version = data.resolve("PG_VERSION");
        String owner = clave("propietario");
        if (!Files.isRegularFile(version)) {
            Path secret = Files.createTempFile(home, "init-", ".txt");
            try {
                Files.writeString(secret, owner);
                verificar("initdb", "-D", data.toString(), "-U", OWNER,
                        "--auth=scram-sha-256", "--encoding=UTF8", "--locale=C", "--pwfile=" + secret);
            } finally {
                Files.deleteIfExists(secret);
            }
        }
        if (ejecutar("pg_ctl", "-D", data.toString(), "status") == 0)
            verificar("pg_ctl", "-D", data.toString(), "-m", "fast", "-w", "stop");
        started = true;
        verificar("pg_ctl", "-D", data.toString(), "-l", home.resolve("postgres.log").toString(),
                "-o", "-h " + EntornoLocal.HOST + " -p " + dbPort, "-w", "start");
        MigradorPostgres.preparar(url("postgres"), url(MigradorPostgres.DATABASE), OWNER, owner, clave("aplicacion"));
    }

    private String clave(String nombre) throws IOException {
        Path file = home.resolve(nombre + ".clave");
        if (!Files.exists(file))
            Files.writeString(file, UUID.randomUUID().toString() + UUID.randomUUID(), StandardOpenOption.CREATE_NEW);
        String password = Files.readString(file).strip();
        if (!password.matches("[a-f0-9-]{72}"))
            throw new IOException("La clave local de PostgreSQL tiene un formato inesperado: " + file);
        return password;
    }

    private String url(String db) {
        return "jdbc:postgresql://" + EntornoLocal.HOST + ":" + dbPort + "/" + db;
    }

    public Map<String, Object> propiedades() throws IOException {
        return Map.of(
                "spring.datasource.url", url(MigradorPostgres.DATABASE),
                "spring.datasource.username", MigradorPostgres.APP_USER,
                "spring.datasource.password", clave("aplicacion"));
    }

    private static Path detectarPostgres(Path data) throws IOException {
        String configured = System.getenv("VALES_PG_BIN");
        if (configured != null && !configured.isBlank()) {
            Path bin = Path.of(configured);
            if (valido(bin)) return bin.toAbsolutePath();
            throw new IOException("VALES_PG_BIN debe apuntar a la carpeta bin de PostgreSQL.");
        }
        Path installations = WINDOWS ? Path.of(System.getenv().getOrDefault("ProgramFiles", "C:/Program Files"), "PostgreSQL")
                : Path.of("/usr/lib/postgresql");
        if (Files.isDirectory(installations)) {
            String major = Files.isRegularFile(data.resolve("PG_VERSION"))
                    ? Files.readString(data.resolve("PG_VERSION")).strip() : "";
            try (Stream<Path> dirs = Files.list(installations)) {
                var installed = dirs.filter(p -> p.getFileName().toString().matches("[0-9]+"))
                        .filter(p -> major.isEmpty() || p.getFileName().toString().equals(major))
                        .sorted(Comparator.comparingInt((Path p) -> Integer.parseInt(p.getFileName().toString())).reversed())
                        .map(p -> p.resolve("bin")).filter(BaseLocal::valido).findFirst();
                if (installed.isPresent()) return installed.get();
            }
        }
        for (String directory : System.getenv().getOrDefault("PATH", "").split(Pattern.quote(java.io.File.pathSeparator))) {
            if (!directory.isBlank() && valido(Path.of(directory))) return Path.of(directory).toAbsolutePath();
        }
        throw new IOException("Instala PostgreSQL o configura VALES_PG_BIN con la ruta de su carpeta bin.");
    }

    private static boolean valido(Path bin) {
        return Files.isRegularFile(bin.resolve(ejecutable("pg_ctl"))) && Files.isRegularFile(bin.resolve(ejecutable("initdb")));
    }

    private static String ejecutable(String name) {
        return WINDOWS ? name + ".exe" : name;
    }

    private int ejecutar(String program, String... args) throws IOException, InterruptedException {
        var command = new ArrayList<String>();
        command.add(bin.resolve(ejecutable(program)).toString());
        command.addAll(List.of(args));
        Process process = new ProcessBuilder(command).redirectErrorStream(true)
                .redirectOutput(ProcessBuilder.Redirect.appendTo(home.resolve("arranque.log").toFile())).start();
        if (!process.waitFor(110, TimeUnit.SECONDS)) {
            process.destroyForcibly();
            throw new IOException("Tiempo de espera agotado en " + program + ". Revisa " + home.resolve("arranque.log"));
        }
        return process.exitValue();
    }

    private void verificar(String program, String... args) throws IOException, InterruptedException {
        if (ejecutar(program, args) != 0)
            throw new IOException("Falló " + program + ". Revisa " + home.resolve("arranque.log") + " y postgres.log.");
    }

    @Override
    public synchronized void close() {
        if (!lock.isValid()) return;
        try {
            if (started && ejecutar("pg_ctl", "-D", data.toString(), "status") == 0)
                verificar("pg_ctl", "-D", data.toString(), "-m", "fast", "-w", "stop");
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
        } catch (IOException error) {
            System.err.println(error.getMessage());
        } finally {
            started = false;
            try {
                lock.release();
                lockChannel.close();
            } catch (IOException error) {
                System.err.println(error.getMessage());
            }
        }
    }
}
