import "dotenv/config";
import { env } from "./src/server/config/env.js";
import { server } from "./src/server/app.js";

server.listen(env.port);
