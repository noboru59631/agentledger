import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL("../app/", import.meta.url).pathname;
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
createServer(async (request, response) => {
  const route = request.url === "/" ? "/index.html" : request.url.split("?")[0];
  const file = normalize(join(root, route));
  if (!file.startsWith(normalize(root))) { response.writeHead(403).end(); return; }
  try { response.writeHead(200, { "content-type": types[extname(file)] || "text/plain" }); response.end(await readFile(file)); }
  catch { response.writeHead(404).end("Not found"); }
}).listen(4173, () => console.log("AgentLedger demo: http://localhost:4173"));
