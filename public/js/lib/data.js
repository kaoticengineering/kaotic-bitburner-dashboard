/**
 * data.js - Static Data for Bitburner Dashboard
 * 
 * Contains all lookup tables, mappings, and constant data used
 * across the dashboard. No logic, no DOM access - just data.
 */

(() => {
  // ============================================================
  // FACTION WORK TYPES
  // Maps shorthand keys to available work types for factions
  // ============================================================
  const F_WORK = {
    H:   ["Hacking"],
    HS:  ["Hacking", "Security"],
    HF:  ["Hacking", "Field"],
    HFS: ["Hacking", "Field", "Security"],
    FS:  ["Field", "Security"],
    F:   ["Field"],
    S:   ["Security"],
  };

  // ============================================================
  // COMPANY WORK TYPES
  // Maps shorthand keys to available work types for companies
  // ============================================================
  const C_WORK = {
    S:     ["Software"],
    I:     ["IT"],
    B:     ["Business"],
    SE:    ["Security"],
    SIB:   ["Software", "IT", "Business"],
    SIBSE: ["Software", "IT", "Business", "Security"],
  };

  // ============================================================
  // GYM & UNIVERSITY OPTIONS
  // ============================================================
  const GYM_STATS = ["Strength", "Defense", "Dexterity", "Agility"];
  const UNI_COURSES = ["Leadership", "Algorithms"];

  // ============================================================
  // CRIMES
  // ============================================================
  const CRIMES = [
    "Shoplift",
    "Rob Store",
    "Mug",
    "Larceny",
    "Deal Drugs",
    "Bond Forgery",
    "Traffick Arms",
    "Homicide",
    "Grand Theft Auto",
    "Kidnap",
    "Assassination",
    "Heist",
  ];

  // ============================================================
  // COMPANIES
  // ============================================================
  const COMPANY_NAMES = [
    "ECorp",
    "MegaCorp",
    "Bachman & Associates",
    "Blade Industries",
    "NWO",
    "Clarke Incorporated",
    "OmniTek Incorporated",
    "Four Sigma",
    "KuaiGong International",
    "Fulcrum Technologies",
  ];

  const COMPANY_DETAIL_KEY = {
    "ECorp": "SIBSE",
    "MegaCorp": "SIBSE",
    "Bachman & Associates": "SIBSE",
    "Blade Industries": "SIBSE",
    "NWO": "SIBSE",
    "Clarke Incorporated": "SIBSE",
    "OmniTek Incorporated": "SIBSE",
    "Four Sigma": "SIBSE",
    "KuaiGong International": "SIBSE",
    "Fulcrum Technologies": "SIB",
  };

  // Build the details-by-name lookup
  const COMPANY_DETAILS_BY_NAME = Object.fromEntries(
    Object.entries(COMPANY_DETAIL_KEY)
      .filter(([, key]) => key && C_WORK[key])
      .map(([name, key]) => [name, C_WORK[key]])
  );

  // ============================================================
  // FACTIONS
  // ============================================================
  const FACTION_NAMES = [
    "CyberSec",
    "NiteSec",
    "The Black Hand",
    "BitRunners",
    "Tian Di Hui",
    "Netburners",
    "Sector-12",
    "Chongqing",
    "New Tokyo",
    "Ishima",
    "Aevum",
    "Volhaven",
    "ECorp",
    "MegaCorp",
    "KuaiGong International",
    "Four Sigma",
    "NWO",
    "Blade Industries",
    "OmniTek Incorporated",
    "Bachman & Associates",
    "Clarke Incorporated",
    "Fulcrum Secret Technologies",
    "Slum Snakes",
    "Tetrads",
    "Silhouette",
    "Speakers for the Dead",
    "The Dark Army",
    "The Syndicate",
    "The Covenant",
    "The Illuminati",
    "Daedalus",
  ];

  const FACTION_DETAIL_KEY = {
    "CyberSec": "H",
    "NiteSec": "H",
    "The Black Hand": "HF",
    "BitRunners": "H",
    "Tian Di Hui": "HS",
    "Netburners": "H",
    "Sector-12": "HFS",
    "Chongqing": "HFS",
    "New Tokyo": "HFS",
    "Ishima": "HFS",
    "Aevum": "HFS",
    "Volhaven": "HFS",
    "ECorp": "HFS",
    "MegaCorp": "HFS",
    "KuaiGong International": "HFS",
    "Four Sigma": "HFS",
    "NWO": "HFS",
    "Blade Industries": "HFS",
    "OmniTek Incorporated": "HFS",
    "Bachman & Associates": "HFS",
    "Clarke Incorporated": "HFS",
    "Fulcrum Secret Technologies": "HFS",
    "Slum Snakes": "FS",
    "Tetrads": "FS",
    "Silhouette": "HFS",
    "Speakers for the Dead": "HFS",
    "The Dark Army": "HF",
    "The Syndicate": "HFS",
    "The Covenant": "HF",
    "The Illuminati": "HF",
    "Daedalus": "HF",
  };

  // Build the details-by-name lookup
  const FACTION_DETAILS_BY_NAME = Object.fromEntries(
    Object.entries(FACTION_DETAIL_KEY)
      .filter(([, key]) => key && F_WORK[key])
      .map(([name, key]) => [name, F_WORK[key]])
  );

  // ============================================================
  // WORK LIBRARY
  // Central registry of all work types and their options
  // ============================================================
  const WORK_LIBRARY = {
    COMPANY: {
      names: COMPANY_NAMES,
      detailsByName: COMPANY_DETAILS_BY_NAME,
      details: C_WORK.SIBSE,
      defaultDetail: "Software",
    },
    FACTION: {
      names: FACTION_NAMES,
      detailsByName: FACTION_DETAILS_BY_NAME,
      details: ["Hacking", "Field", "Security"],
      defaultDetail: "Hacking",
    },
    UNIV: {
      names: ["ZB Institute of Technology", "Rothman University"],
      details: UNI_COURSES,
      defaultDetail: "Algorithms",
    },
    GYM: {
      names: ["Powerhouse Gym", "Snap Fitness"],
      details: GYM_STATS,
      defaultDetail: "Strength",
    },
    CRIME: {
      names: CRIMES,
      details: null,
      defaultDetail: null,
    },
  };

  // ============================================================
  // BITNODE NAMES
  // ============================================================
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
    14: "IPvGO Subnet Takeover",
  };

  // ============================================================
  // EXPORT
  // ============================================================
  window.DATA = {
    // Work type mappings
    F_WORK,
    C_WORK,
    
    // Options
    GYM_STATS,
    UNI_COURSES,
    CRIMES,
    
    // Companies
    COMPANY_NAMES,
    COMPANY_DETAIL_KEY,
    COMPANY_DETAILS_BY_NAME,
    
    // Factions
    FACTION_NAMES,
    FACTION_DETAIL_KEY,
    FACTION_DETAILS_BY_NAME,
    
    // Central library
    WORK_LIBRARY,
    
    // BitNode info
    BITNODE_NAMES,
  };

})();
