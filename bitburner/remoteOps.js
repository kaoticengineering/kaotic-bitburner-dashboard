/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("sleep");
  ns.disableLog("getServerUsedRam");
  ns.disableLog("getServerMaxRam");

  // ============== CONFIGURATION ==============
  const SERVER_URL = "http://10.0.0.74:3000";
  const DATA_ENDPOINT = `${SERVER_URL}/bitburner-data`;
  const CMD_ENDPOINT = `${SERVER_URL}/commands/next`;

  const SEND_DATA_MS = 500;
  const TRY_GET_CMD_MS = 500;

  // For Sampling | Calculating perSecond Data
  const SAMPLING_WINDOW_MS = 10000;
  const RATE_ALPHA = 0.1; // EMA smoothing factor

  // Dashboard "stale" threshold (seconds)
  const SAMPLE_WARN_SEC = 10;

  // ============== MAPPINGS ==============

  // Maps classType strings to the stat being trained
  const CLASS_TYPE_TO_STAT = {
    // Gym
    "Train Strength": "str",
    "Train Defense": "def",
    "Train Dexterity": "dex",
    "Train Agility": "agi",
    // University
    "Study Computer Science": "hack",
    "Algorithms": "hack",
    "Leadership": "cha",
    "Management": "cha",
  };

  // BitNode names (for display purposes)
  const BITNODE_NAMES = {
    1: "Source Genesis",
    2: "Rise of the Underworld",
    3: "Corporatocracy",
    4: "The Singularity",
    5: "Artificial Intelligence",
    6: "Bladeburners",
    7: "Bladeburners 2079",
    8: "Ghost of Wall Street",
    9: "Hacktocracy",
    10: "Digital Carbon",
    11: "The Big Crash",
    12: "The Recursion",
    13: "They're Lunatics",
    14: "IPvGO Subnet",
  };

  // Port opener programs
  const PORT_OPENER_EXES = [
    "BruteSSH.exe",
    "FTPCrack.exe",
    "relaySMTP.exe",
    "HTTPWorm.exe",
    "SQLInject.exe",
  ];

  // City locations for Gyms and Universities
  const GYM_CITIES = {
    "Powerhouse Gym": "Sector-12",
    "Snap Fitness": "Aevum",
    "Iron Gym": "Sector-12",
    "Millenium Fitness Gym": "Volhaven",
    "Crush Fitness Gym": "Aevum",
  };

  const UNIVERSITY_CITIES = {
    "Rothman University": "Sector-12",
    "ZB Institute of Technology": "Volhaven",
    "Summit University": "Aevum",
  };

  // ============== STATE ==============

  ns.tprint("bbRemoteOps -> Running");

  let nextTelemetryTime = 0;
  let nextCommandTime = 0;

  // Backoff tracking when server is down
  let consecutiveFailures = 0;

  // Work tracking for rate calculations
  let lastWorkKey = null;
  let lastRateSampleTime = 0;

  // Unified rate tracking object
  let rateTracking = {
    rep: { lastValue: null, perSecEma: null },
    exp: { stat: null, lastValue: null, perSecEma: null },
  };

  // ============== MAIN LOOP ==============

  while (true) {
    const now = Date.now();

    // ---- Telemetry ----
    if (now >= nextTelemetryTime) {
      try {
        const payload = buildTelemetryPayload(ns, now, {
          sampleWarnSec: SAMPLE_WARN_SEC,
          samplingWindowMs: SAMPLING_WINDOW_MS,
          rateAlpha: RATE_ALPHA,
          classTypeToStat: CLASS_TYPE_TO_STAT,
          bitnodeNames: BITNODE_NAMES,
          portOpenerExes: PORT_OPENER_EXES,
        });

        await fetch(DATA_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        consecutiveFailures = 0;
      } catch (error) {
        consecutiveFailures++;
        ns.print(`Failed to send stats: ${String(error)}`);
      } finally {
        nextTelemetryTime = now + SEND_DATA_MS;
      }
    }

    // ---- Commands ----
    if (now >= nextCommandTime) {
      try {
        const response = await fetch(CMD_ENDPOINT, {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        if (response.status === 204) {
          // No command available
        } else if (response.ok) {
          const cmd = await response.json();
          if (cmd && cmd.type) {
            await handleCommand(ns, cmd);
          }
        } else {
          ns.print(`Command poll bad status: ${response.status}`);
        }

        consecutiveFailures = 0;
      } catch (error) {
        consecutiveFailures++;
        ns.print(`Command poll error: ${String(error)}`);
      } finally {
        nextCommandTime = now + TRY_GET_CMD_MS;
      }
    }

    // Smart sleep: wait until the next deadline
    const nextWakeTime = Math.min(nextTelemetryTime, nextCommandTime);
    let sleepDuration = Math.max(1, nextWakeTime - Date.now());

    // Backoff if server is down (caps at 5s)
    if (consecutiveFailures > 0) {
      const backoffMs = Math.min(5000, 250 * consecutiveFailures);
      sleepDuration = Math.max(sleepDuration, backoffMs);
    }

    await ns.sleep(Math.min(sleepDuration, 200));
  }

  // ============== TELEMETRY BUILDER ==============

  function buildTelemetryPayload(ns, timestamp, config) {
    const player = ns.getPlayer();
    const homeServer = ns.getServer("home");
    const resetInfo = ns.getResetInfo();

    // BitNode level
    const bitnodeNumber = resetInfo.currentNode;
    const previousCompletions = resetInfo.ownedSF.get(bitnodeNumber) ?? 0;
    const bitnodeLevel = previousCompletions + 1;

    // Get current work (if Singularity API available)
    let currentWork = null;
    try {
      currentWork = ns.singularity?.getCurrentWork?.() ?? null;
    } catch {}

    // Process running scripts
    const allProcs = ns.ps("home");
    const isAttackScript = (proc) => String(proc.filename).startsWith("attack_");
    const attackProcs = allProcs.filter(isAttackScript);
    const otherProcs = allProcs.filter((proc) => !isAttackScript(proc));

    const homeProcs = otherProcs.map((proc) => ({
      filename: proc.filename,
      threads: proc.threads,
      args: proc.args,
      pid: proc.pid,
    }));

    const attackSummary = {
      instances: attackProcs.length,
      threads: attackProcs.reduce((sum, proc) => sum + (proc.threads ?? 0), 0),
    };

    const attackByScript = summarizeAttackScripts(attackProcs);

    // Update rate tracking
    const currentWorkKey = computeWorkKey(currentWork);
    const workInfo = updateRateTracking(
      ns,
      player,
      currentWork,
      currentWorkKey,
      timestamp,
      config
    );

    // Build the payload
    return {
      time: timestamp,
      configEcho: { sampleWarnSec: config.sampleWarnSec },

      player: {
        money: player.money,
        hpCurrent: player.hp.current,
        hpMax: player.hp.max,
        karma: player.karma,
        kills: player.numPeopleKilled,
        city: player.city,

        bitnode: {
          number: bitnodeNumber,
          name: config.bitnodeNames[bitnodeNumber] ?? "Unknown",
          level: bitnodeLevel,
        },

        stats: {
          hack: player.skills.hacking,
          str: player.skills.strength,
          def: player.skills.defense,
          dex: player.skills.dexterity,
          agi: player.skills.agility,
          cha: player.skills.charisma,
          int: player.skills.intelligence,
        },

        work: workInfo,
      },

      home: {
        maxRam: homeServer.maxRam,
        usedRam: homeServer.ramUsed,
        cpuCores: homeServer.cpuCores,
        procs: homeProcs,
        attackSummary,
        attackByScript,
      },

      // Additional info
      programs: gatherProgramInfo(ns, config.portOpenerExes),
      stockApi: gatherStockApiInfo(ns),
      ipvgo: gatherIpvgoBonuses(ns),
    };
  }

  // ============== RATE TRACKING ==============

  function updateRateTracking(ns, player, work, workKey, nowMs, config) {
    // Reset tracking when work changes
    if (workKey !== lastWorkKey) {
      lastWorkKey = workKey;
      lastRateSampleTime = nowMs;
      rateTracking = {
        rep: { lastValue: null, perSecEma: null },
        exp: { stat: null, lastValue: null, perSecEma: null },
      };
    }

    const deltaTimeMs = nowMs - lastRateSampleTime;

    // Only recalculate rates every SAMPLING_WINDOW_MS
    if (deltaTimeMs >= config.samplingWindowMs) {
      const deltaSec = deltaTimeMs / 1000;

      // --- Reputation Rate ---
      if (work && (work.type === "COMPANY" || work.type === "FACTION")) {
        const faction = work.factionName;
        const company = work.companyName;

        let currentRep = null;
        if (faction) {
          try {
            currentRep = ns.singularity.getFactionRep(faction);
          } catch {}
        } else if (company) {
          try {
            currentRep = ns.singularity.getCompanyRep(company);
          } catch {}
        }

        if (currentRep != null) {
          if (rateTracking.rep.lastValue != null) {
            const repDelta = currentRep - rateTracking.rep.lastValue;
            if (repDelta > 0) {
              const instantRate = repDelta / deltaSec;
              rateTracking.rep.perSecEma = emaUpdate(
                rateTracking.rep.perSecEma,
                instantRate,
                config.rateAlpha
              );
            }
          }
          rateTracking.rep.lastValue = currentRep;
        }
      }

      // --- Experience Rate ---
      if (work && work.type === "CLASS") {
        const classType = work.classType ?? "";
        const stat = config.classTypeToStat[classType];
        if (stat) {
          rateTracking.exp.stat = stat;
          const currentExp = player.exp[stat];
          if (currentExp != null) {
            if (rateTracking.exp.lastValue != null) {
              const expDelta = currentExp - rateTracking.exp.lastValue;
              if (expDelta > 0) {
                const instantRate = expDelta / deltaSec;
                rateTracking.exp.perSecEma = emaUpdate(
                  rateTracking.exp.perSecEma,
                  instantRate,
                  config.rateAlpha
                );
              }
            }
            rateTracking.exp.lastValue = currentExp;
          }
        }
      }

      // Advance the baseline time
      lastRateSampleTime = nowMs;
    }

    // Build work info for payload
    if (!work) return null;

    return {
      type: work.type,
      key: workKey,
      cyclesWorked: work.cyclesWorked,

      // Names / descriptors
      companyName: work.companyName,
      factionName: work.factionName,
      factionWorkType: work.factionWorkType,
      crimeType: work.crimeType,
      classType: work.classType,
      location: work.location,
      augmentation: work.augmentation,

      // Computed rates
      repPerSec: rateTracking.rep.perSecEma,
      expPerSec:
        rateTracking.exp.stat && rateTracking.exp.perSecEma != null
          ? { stat: rateTracking.exp.stat, rate: rateTracking.exp.perSecEma }
          : null,
    };
  }

  // ============== HELPER FUNCTIONS ==============

  function computeWorkKey(work) {
    if (!work) return "IDLE";
    switch (work.type) {
      case "COMPANY":
        return `COMPANY:${work.companyName ?? ""}`;
      case "FACTION":
        return `FACTION:${work.factionName ?? ""}:${work.factionWorkType ?? ""}`;
      case "CLASS":
        return `CLASS:${work.classType ?? ""}:${work.location ?? ""}`;
      case "CRIME":
        return `CRIME:${work.crimeType ?? ""}`;
      default:
        return `${work.type}`;
    }
  }

  function emaUpdate(previousValue, newValue, alpha) {
    if (previousValue == null) return newValue;
    return previousValue + alpha * (newValue - previousValue);
  }

  function summarizeAttackScripts(attackProcs) {
    const byScript = {};
    for (const proc of attackProcs) {
      const key = String(proc.filename);
      if (!byScript[key]) {
        byScript[key] = { filename: key, instances: 0, threads: 0 };
      }
      byScript[key].instances += 1;
      byScript[key].threads += proc.threads ?? 0;
    }
    return Object.values(byScript)
      .sort((a, b) => b.threads - a.threads)
      .slice(0, 10);
  }

  function gatherProgramInfo(ns, portOpenerExes) {
    // Check TOR ownership
    // There doesn't seem to be a more direct way to do this
      let hasTor = false;
      try {
        // If getDarkwebProgramCost returns -1, TOR is not owned
        // If it returns >= 0, TOR is owned
        const cost = ns.singularity?.getDarkwebProgramCost?.("BruteSSH.exe");
        hasTor = cost !== undefined && cost !== -1;
      } catch {
        // Singularity not available,.. try checking if darkweb programs exist
      }

    // Check which port openers are owned
    const ownedExes = portOpenerExes.filter((exe) => ns.fileExists(exe, "home"));

    return {
      hasTor,
      portOpeners: {
        owned: ownedExes,
        count: ownedExes.length,
        total: portOpenerExes.length,
      },
    };
  }

  function gatherStockApiInfo(ns) {
    let hasTixApi = false;
    let has4sData = false;

    try {
      hasTixApi = ns.stock?.hasTIXAPIAccess?.() ?? false;
    } catch {}

    try {
      has4sData = ns.stock?.has4SDataTIXAPI?.() ?? false;
    } catch {}

    return {
      hasTixApi,
      has4sData,
    };
  }

  function gatherIpvgoBonuses(ns) {
    try {
      const stats = ns.go?.analysis?.getStats?.();
      if (stats && typeof stats === "object") {
        // Extract just the bonus info for each faction
        const bonuses = {};
        for (const [faction, data] of Object.entries(stats)) {
          bonuses[faction] = {
            bonusPercent: data.bonusPercent,
            bonusDescription: data.bonusDescription,
          };
        }
        return bonuses;
      }
    } catch {}
    return null;
  }

  function coerceArg(arg) {
    if (typeof arg !== "string") return arg;
    const trimmed = arg.trim();
    if (trimmed === "") return trimmed;
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed === "null") return null;

    const num = Number(trimmed);
    if (!Number.isNaN(num) && Number.isFinite(num)) return num;

    return arg;
  }

  // ============== COMMAND HANDLER ==============

  async function handleCommand(ns, cmd) {
    switch (cmd.type) {
      case "scriptAction": {
        const action = String(cmd.action || cmd.payload?.action || "").toLowerCase();
        const src = cmd.payload ?? cmd;

        const host = src.host ?? "home";
        const script = src.script;
        const threads = Math.max(1, Math.floor(Number(src.threads ?? 1)));
        const argsRaw = Array.isArray(src.args) ? src.args : [];
        const args = argsRaw.map(coerceArg);

        if (!script) {
          ns.tprint(`[CMD ${cmd.id ?? "?"}] scriptAction missing script.`);
          break;
        }

        if (action === "run") {
          const pid =
            host === "home"
              ? ns.run(script, threads, ...args)
              : ns.exec(script, host, threads, ...args);

          ns.tprint(
            pid === 0
              ? `[CMD ${cmd.id ?? "?"}] Failed RUN ${script} on ${host}.`
              : `[CMD ${cmd.id ?? "?"}] RUN ${script} on ${host} pid=${pid}.`
          );
          break;
        }

        if (action === "kill") {
          const ok = ns.scriptKill(script, host);
          ns.tprint(`[CMD ${cmd.id ?? "?"}] KILL ${script} on ${host}: ${ok}`);
          break;
        }

        if (action === "restart") {
          if (ns.scriptRunning(script, host)) {
            ns.scriptKill(script, host);
            await ns.sleep(50);
          }

          const pid =
            host === "home"
              ? ns.run(script, threads, ...args)
              : ns.exec(script, host, threads, ...args);

          ns.tprint(
            pid === 0
              ? `[CMD ${cmd.id ?? "?"}] Failed RESTART ${script} on ${host}.`
              : `[CMD ${cmd.id ?? "?"}] RESTART ${script} on ${host} pid=${pid}.`
          );
          break;
        }

        ns.tprint(`[CMD ${cmd.id ?? "?"}] Unknown scriptAction action: ${action}`);
        break;
      }

      case "workAction": {
        const src = cmd.payload ?? cmd;
        const action = String(src.action ?? "start").toLowerCase();

        if (action === "stop") {
          ns.singularity.stopAction();
          ns.tprint(`[CMD ${cmd.id ?? "?"}] stopAction()`);
          break;
        }

        const workType = String(src.workType ?? "").toUpperCase();
        const focus = Boolean(src.focus ?? false);

        // Always stop current action before switching
        ns.singularity.stopAction();
        await ns.sleep(50);

        let ok = false;
        let needsTravel = false;
        let targetCity = null;

        // Check if we need to travel for GYM or UNIV
        if (workType === "GYM") {
          const gymName = String(src.gymName ?? "");
          targetCity = GYM_CITIES[gymName];
          if (targetCity) {
            const currentCity = ns.getPlayer().city;
            needsTravel = currentCity !== targetCity;
          }
        } else if (workType === "UNIV") {
          const uniName = String(src.universityName ?? "");
          targetCity = UNIVERSITY_CITIES[uniName];
          if (targetCity) {
            const currentCity = ns.getPlayer().city;
            needsTravel = currentCity !== targetCity;
          }
        }

        // Travel if needed
        if (needsTravel && targetCity) {
          const travelSuccess = ns.singularity.travelToCity(targetCity);
          if (!travelSuccess) {
            ns.tprint(`[CMD ${cmd.id ?? "?"}] Failed to travel to ${targetCity} for ${workType}`);
            break;
          }
          ns.tprint(`[CMD ${cmd.id ?? "?"}] Traveled to ${targetCity} for ${workType}`);
          await ns.sleep(100); // Give game time to process travel
        }

        // Execute work command
        if (workType === "COMPANY") {
          ok = ns.singularity.workForCompany(String(src.companyName ?? ""), focus);
        } else if (workType === "FACTION") {
          ok = ns.singularity.workForFaction(
            String(src.factionName ?? ""),
            String(src.factionWorkType ?? "Hacking"),
            focus
          );
        } else if (workType === "CRIME") {
          const ms = ns.singularity.commitCrime(String(src.crime ?? "Shoplift"), focus);
          ok = ms > 0;
        } else if (workType === "GYM") {
          ok = ns.singularity.gymWorkout(
            String(src.gymName ?? ""),
            String(src.stat ?? "Strength"),
            focus
          );
        } else if (workType === "UNIV") {
          ok = ns.singularity.universityCourse(
            String(src.universityName ?? ""),
            String(src.course ?? "Algorithms"),
            focus
          );
        } else {
          ns.tprint(`[CMD ${cmd.id ?? "?"}] Unknown workType: ${workType}`);
          break;
        }

        ns.tprint(`[CMD ${cmd.id ?? "?"}] workAction ${workType} ok=${ok}`);
        break;
      }

      default:
        ns.tprint(`[CMD ${cmd.id ?? "?"}] Unknown command type: ${cmd.type}`);
    }
  }
}