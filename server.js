import "dotenv/config";
import { env } from "./src/server/config/env.js";
import { createApp } from "./src/server/app.js";

createApp().listen(env.port);
