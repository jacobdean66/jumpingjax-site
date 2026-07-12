import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { google } from "googleapis";

const ENV_PATH = ".env.local";
const PORT = Number(process.env.GOOGLE_OAUTH_LOCAL_PORT || 42813);
const REDIRECT_URI = `http://127.0.0.1:${PORT}/oauth2callback`;
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

function loadEnv(path) {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .reduce((env, line) => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
      }
      return env;
    }, {});
}

function requireEnv(env, key) {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`Missing ${key} in ${ENV_PATH}`);
  }
  return value;
}

async function listenForCode(oauth2Client, authorizeUrl) {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const requestUrl = new URL(req.url ?? "/", REDIRECT_URI);
        if (requestUrl.pathname !== "/oauth2callback") {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not found");
          return;
        }

        const error = requestUrl.searchParams.get("error");
        if (error) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Google authorization failed. You can close this tab.");
          server.close();
          reject(new Error(`Google authorization failed: ${error}`));
          return;
        }

        const code = requestUrl.searchParams.get("code");
        if (!code) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Missing authorization code. You can close this tab.");
          server.close();
          reject(new Error("Missing authorization code"));
          return;
        }

        const { tokens } = await oauth2Client.getToken(code);
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Google Calendar authorization complete. You can close this tab.");
        server.close();
        resolve(tokens);
      } catch (error) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Token exchange failed. You can close this tab.");
        server.close();
        reject(error);
      }
    });

    server.on("error", reject);
    server.listen(PORT, "127.0.0.1", () => {
      console.log("Open this Google authorization URL:");
      console.log(authorizeUrl);
      console.log("");
      console.log(`Waiting for callback on ${REDIRECT_URI}`);
    });
  });
}

async function main() {
  const env = loadEnv(ENV_PATH);
  const clientId = requireEnv(env, "GOOGLE_CLIENT_ID");
  const clientSecret = requireEnv(env, "GOOGLE_CLIENT_SECRET");
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    REDIRECT_URI,
  );

  const authorizeUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [CALENDAR_SCOPE],
  });

  const tokens = await listenForCode(oauth2Client, authorizeUrl);
  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. Re-run and make sure prompt=consent is used.",
    );
  }

  console.log("");
  console.log("New GOOGLE_REFRESH_TOKEN:");
  console.log(tokens.refresh_token);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
