const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function ensureLocalDomain() {
  const localDomain = path.join(root, "localdomain.js");
  const defaultLocalDomain = path.join(root, "localdomain.default.js");
  if (!fs.existsSync(localDomain)) {
    fs.copyFileSync(defaultLocalDomain, localDomain);
  }
}

ensureLocalDomain();
run("node", ["scripts/build-markdown.js"]);
run("node", ["-r", "ts-node/register/transpile-only", "scripts/build-programs.ts"]);
run("npx", ["webpack", "--config", "webpack.config.js"], {
  NODE_ENV: "production",
  WORKOUTTHING_PWA: "true",
});
