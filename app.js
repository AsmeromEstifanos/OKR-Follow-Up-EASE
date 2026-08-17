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
        // Next is configured with basePath, so it expects the prefix to still be
        // on the URL. Passenger's PassengerBaseURI behaviour varies by host: some
        // forward the full path, some strip it. Normalize by ENSURING the prefix
        // is present rather than removing it, which works either way.
        //
        // Do not strip the prefix here. Stripping only appeared to work while the
        // runtime config had no basePath (NEXT_PUBLIC_BASE_PATH missing from the
        // server .env); in that state Next served "/" but emitted asset URLs
        // without the prefix, so the CSS and framework chunks 404'd.
        if (basePath && req.url) {
          if (req.url === basePath) {
            req.url = basePath + "/";
          } else if (req.url.startsWith(basePath + "/") || req.url.startsWith(basePath + "?")) {
            // already prefixed - leave it alone
          } else {
            req.url = basePath + (req.url.startsWith("/") ? "" : "/") + req.url;
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
