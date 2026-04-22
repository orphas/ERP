const http = require("http");

// Constrained shared-hosting environments can fail when native runtimes
// (Rust/Tokio/Rayon/libuv) try to spawn multiple workers.
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || "1";
process.env.TOKIO_WORKER_THREADS = process.env.TOKIO_WORKER_THREADS || "1";
process.env.RAYON_NUM_THREADS = process.env.RAYON_NUM_THREADS || "1";

const next = require("next");

const port = Number.parseInt(process.env.PORT || process.env.APP_PORT || "3000", 10);
const hostname = "0.0.0.0";
const app = next({
  dev: false,
  dir: __dirname,
  hostname,
  port,
});
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    http
      .createServer((req, res) => handle(req, res))
      .listen(port, hostname, () => {
        console.log(`ERP app ready on http://${hostname}:${port}`);
      });
  })
  .catch((error) => {
    console.error("Failed to start ERP app", error);
    process.exit(1);
  });