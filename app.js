const http = require("http");
const fs = require("fs");
const path = require("path");
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

const logPath = path.join(__dirname, "debug.log");
function debug(msg) {
  try {
    fs.appendFileSync(logPath, `${new Date().toISOString()} ${msg}\n`);
  } catch (_e) {}
}

debug(`STARTUP basePath=${basePath || "(none)"} port=${port}`);

const app = next({ dev, hostname: host, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    http
      .createServer((req, res) => {
        const originalUrl = req.url;
        if (basePath && req.url) {
          if (req.url === basePath) {
            req.url = "/";
          } else if (req.url.startsWith(basePath + "/")) {
            req.url = req.url.slice(basePath.length);
          } else if (req.url.startsWith(basePath + "?")) {
            req.url = "/" + req.url.slice(basePath.length + 1);
          }
        }
        debug(`[req] ${req.method} ${originalUrl} -> ${req.url}`);
        void handle(req, res);
      })
      .listen(port, host, () => {
        debug(`READY http://${host}:${port}`);
      });
  })
  .catch((error) => {
    debug(`FATAL ${error && error.stack ? error.stack : String(error)}`);
    process.exit(1);
  });
