/*
Hi. I'm a noob but this works and stuff so..
*/

const path = require("path");
const express = require("express");
const app = express();

app.use(express.json({ limit: "1mb" }));

// Command Queue
let commandQueue = [];
let nextCommandId = 1;

// Enqueue a command
// This will obviously be commands coming
// from the 'Dashboard', adding to 
// a queue that the BB script will poll/ pluck
// commands from in the /commands/next route below
app.post("/command", authIfEnabled, (req, res) => {
  const { type, payload } = req.body ?? {};

  if (!type) {
    return res.status(400).json({ ok: false, error: "Missing 'type'." });
  }

  const flat = (payload && typeof payload === "object") ? payload : {};
  const cmd = {
   ...flat,
   id: nextCommandId++,
   type: String(type),
   createdAt: Date.now(),
 };

  commandQueue.push(cmd);

  function describeCmd(cmd) {
    if (cmd.type === "scriptAction") {
      return `${cmd.action} | ${cmd.script} | ${cmd.threads} thread | on ${cmd.host}`;
    }
    if (cmd.type === "workAction") {
      const target =
        cmd.companyName || cmd.factionName || cmd.crime || cmd.gymName || cmd.universityName || "—";
      const detail = cmd.factionWorkType || cmd.stat || cmd.course || "";
      return `${cmd.action} | ${cmd.workType} | ${target}${detail ? ` | ${detail}` : ""} | focus=${!!cmd.focus}`;
    }
    return JSON.stringify(cmd);
  }

  console.log(`[Command Queued][ #${cmd.id} ] \ ${describeCmd(cmd)}`);


  res.json({ ok: true, id: cmd.id, queued: commandQueue.length });
});

// Pull ONE command (and remove it from the queue)
// This will obviously be from the BB script
app.get("/commands/next", authIfEnabled, (req, res) => {
  const cmd = commandQueue.shift();

  if (!cmd) {
    return res.status(204).end();
  }

  function describeCmd(cmd) {
    if (cmd.type === "scriptAction") {
      return `${cmd.action} | ${cmd.script} | ${cmd.threads} thread | on ${cmd.host}`;
    }
    if (cmd.type === "workAction") {
      const target =
        cmd.companyName || cmd.factionName || cmd.crime || cmd.gymName || cmd.universityName || "—";
      const detail = cmd.factionWorkType || cmd.stat || cmd.course || "";
      return `${cmd.action} | ${cmd.workType} | ${target}${detail ? ` | ${detail}` : ""} | focus=${!!cmd.focus}`;
    }
    return JSON.stringify(cmd);
  }

  console.log(`[Command Sent][ #${cmd.id} ] \ ${describeCmd(cmd)}`);

  res.json(cmd);
});

// This just lets you look at the queue. 
// ^By going to https://127.0.0.1:3000/commands
// Shouldn't normally see commands there though
// Since we poll for them so fast.. Unless you aren't
// Actively trying to fetch them from BB..
app.get("/commands", authIfEnabled, (req, res) => {
  res.json({
    queued: commandQueue.length,
    commands: commandQueue,
  });
});


// State| Config
const state = {
  last: null,
  prev: null,
  config: {
    verboseLogs: false,
    sampleWarnSec: 10,
    requireToken: false
  },
};

const TOKEN = process.env.BB_TOKEN || "dev-token-change-me";

function authIfEnabled(req, res, next) {
  if (!state.config.requireToken) return next();
  const t = req.header("X-BB-Token");
  if (t !== TOKEN) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// SSE from here to the Dashboard
// This is a little bit more advanced than
// just using timed fetches..
const sseClients = new Set();

function currentSnapshot() {
  if (!state.last) return null;
  return {
    ...state.last,
    configEcho: { sampleWarnSec: state.config.sampleWarnSec }
  };
}

function broadcastCurrent() {
  const snap = currentSnapshot();
  if (!snap) return;

  const msg = `data: ${JSON.stringify(snap)}\n\n`;
	for (const res of sseClients) {
	  try { res.write(msg); }
	  catch (e) { sseClients.delete(res); }
	}

}

app.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  res.write("retry: 1000\n\n");

  sseClients.add(res);

  const snap = currentSnapshot();
  if (snap) {
    res.write(`data: ${JSON.stringify(snap)}\n\n`);
  }

  const heartbeat = setInterval(() => {
    res.write(":\n\n"); 
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

/* This is where the BB script should be spamming
   It's Data. In other words, in BB you'll have
   await fetch(http://127.0.0.1:3000/bitburner-data
   method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
*/
app.post("/bitburner-data", authIfEnabled, (req, res) => {
  const data = req.body || {};
  if (typeof data.time !== "number") data.time = Date.now();

  state.prev = state.last;

  const lastPlayer = (state.last && state.last.player) || {};
  const lastStats = lastPlayer.stats || {};
  const newPlayer = data.player || {};
  const newStats = (data.player && data.player.stats) || {};

  state.last = {
    ...(state.last || {}),
    ...data,
    player: {
      ...lastPlayer,
      ...newPlayer,
      stats: {
        ...lastStats,
        ...newStats,
      },
    },
    home: {
      ...((state.last && state.last.home) || {}),
      ...(data.home || {}),
    },
  };

  broadcastCurrent();

  res.sendStatus(200);
});


// This is the "current" BB Data snapshot
// Obviously you can also view this by 
// going to http://127.0.0.1:3000/current
// Which could be helpful if you need to 
// troubleshoot data not making it to your
// Dashboard or something like that.
app.get("/current", (req, res) => {
  const snap = currentSnapshot();
  if (!snap) return res.status(404).json({ error: "No data" });
  res.json(snap);
});

app.get("/config", (req, res) => {
  res.json(state.config);
});

app.post("/config", authIfEnabled, (req, res) => {
  const patch = req.body || {};
  state.config = { ...state.config, ...patch };
  res.json(state.config);
});

// Directly 'serve' the dashboard.html..
// Note, we are kind of expecting dashboard.html
// to be in a folder called public.
// e.g. file|folder structure like:
// someFolder/
//   server.js
//   public/
//    dashboard.html
//    css/
//     dashboard.css
//    js/
//     dashboard.js
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir, { index: "dashboard.html" }));

// Operating on port 3000
// if you don't want this 
// to be LAN-wide,  
// add 127.0.0.1 or localhost
// -> app.listen(PORT, localhost, () => {
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Node Server is running. Access via ` +
  `http://localhost:${PORT}`);
});

