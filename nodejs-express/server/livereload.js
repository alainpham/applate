// Live reload for local dev only, enabled by "npm run dev" (LIVERELOAD=1).
// The browser holds an SSE stream that carries this process' boot id. When
// --watch restarts the server the stream drops, EventSource reconnects on its
// own, sees a new boot id and reloads the page.
//
// Both attach() and closeStreams() are no-ops unless LIVERELOAD=1, so
// server.js can call them unconditionally.

const path = require("path");
const fs = require("fs");

const ENABLED = process.env.LIVERELOAD === "1";
const BOOT_ID = String(Date.now());

const SNIPPET = `<script>
const es = new EventSource("/__livereload");
es.onmessage = (e) => {
    if (!window.__bootId) window.__bootId = e.data;
    else if (window.__bootId !== e.data) location.reload();
};
</script>`;

const streams = new Set();

// Must be called before express.static so the injector sees the request first.
function attach(app, publicDir) {
    if (!ENABLED) return;

    app.get("/__livereload", (req, res) => {
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        });
        res.write(`data: ${BOOT_ID}\n\n`);
        streams.add(res);

        // comments keep the stream alive through idle timeouts
        const ping = setInterval(() => res.write(": ping\n\n"), 30000);
        req.on("close", () => {
            clearInterval(ping);
            streams.delete(res);
        });
    });

    app.use((req, res, next) => {
        const urlPath = req.path.endsWith("/") ? req.path + "index.html" : req.path;
        if (!urlPath.endsWith(".html")) return next();

        const file = path.join(publicDir, urlPath);
        if (!file.startsWith(publicDir + path.sep) || !fs.existsSync(file)) return next();

        const html = fs.readFileSync(file, "utf8");
        res.set("Cache-Control", "no-store").type("html").send(
            html.includes("</body>")
                ? html.replace("</body>", SNIPPET + "</body>")
                : html + SNIPPET
        );
    });

    console.log("Live reload enabled");
}

// Open SSE streams would otherwise keep server.close() from ever completing,
// which would stall every --watch restart.
function closeStreams() {
    for (const res of streams) {
        res.end();
    }
    streams.clear();
}

module.exports = { attach, closeStreams };
