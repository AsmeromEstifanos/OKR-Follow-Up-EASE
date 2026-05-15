const http = require("http");
const next = require("next");

const port = Number(process.env.PORT || process.env.APP_PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
const dev = false;
let basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");
if (!basePath) {
  try {
    const required = require("./.next/required-server-files.json");
    basePath = (required && required.config && required.config.basePath) || "";
  } catch (_e) {
    basePath = "";
  }
}

const app = next({ dev, hostname: host, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    http
      .createServer((req, res) => {
        if (basePath && req.url && !req.url.startsWith(basePath)) {
          req.url = basePath + (req.url === "/" ? "" : req.url);
        }
        void handle(req, res);
      })
      .listen(port, host, () => {
        console.log(`OKR app running on http://${host}:${port} (basePath: ${basePath || "none"})`);
      });
  })
  .catch((error) => {
    console.error("Failed to start Next.js server", error);
    process.exit(1);
  });
