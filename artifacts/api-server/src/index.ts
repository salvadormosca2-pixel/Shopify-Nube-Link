import app from "./app";
import { logger } from "./lib/logger";
import { warmupImageSearch } from "./lib/imageSearch";
import { bootstrapDb } from "./lib/bootstrapDb";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  // Migración aditiva idempotente ANTES de servir tráfico (el releaseCommand
  // de Railway no puede correr drizzle-kit en prod). Si la DB no responde, el
  // proceso sale y Railway reintenta (restartPolicy on_failure).
  await bootstrapDb();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");

    // Precarga el modelo CLIP (búsqueda por imagen) sin bloquear el arranque.
    warmupImageSearch();
  });
}

start().catch((err) => {
  logger.error({ err }, "Error arrancando el servidor");
  process.exit(1);
});
