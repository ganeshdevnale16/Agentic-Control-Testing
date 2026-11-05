// Knowledge base the agent uses to map policy wording to SAP profile
// parameters. Each entry carries the comparison direction, the unit the SAP
// value is stored in, a default severity, and the risk / remediation text used
// in exception write-ups.
//
// zeroDisables: in SAP a value of 0 switches the check off entirely
// (e.g. login/password_expiration_time = 0 means passwords never expire).
// Such a value must be an exception even though "0 <= 90" is numerically true.

export const PARAMETERS = [
  {
    key: "login/min_password_lng",
    label: "Minimum password length",
    unit: "characters",
    dir: "min",
    severity: "High",
    syn: ["password length", "minimum length", "min length", "characters long", "length"],
    exclude: ["history"],
    risk: "Short passwords are easier to guess or brute-force, increasing the risk of unauthorised access to financially significant data.",
  },
  {
    key: "login/min_password_digits",
    label: "Minimum digits in password",
    unit: "digits",
    dir: "min",
    severity: "Low",
    syn: ["digit", "numeric", "number character"],
    risk: "Reduced password complexity lowers resistance to dictionary attacks.",
  },
  {
    key: "login/min_password_specials",
    label: "Minimum special characters",
    unit: "characters",
    dir: "min",
    severity: "Medium",
    syn: ["special", "symbol", "non-alphanumeric"],
    risk: "Passwords without special characters are materially weaker against brute-force and dictionary attacks.",
  },
  {
    key: "login/min_password_uppercase",
    label: "Minimum uppercase letters",
    unit: "letters",
    dir: "min",
    severity: "Low",
    syn: ["uppercase", "upper case", "upper-case", "capital"],
    risk: "Reduced password complexity lowers resistance to dictionary attacks.",
  },
  {
    key: "login/min_password_lowercase",
    label: "Minimum lowercase letters",
    unit: "letters",
    dir: "min",
    severity: "Low",
    syn: ["lowercase", "lower case", "lower-case"],
    risk: "Reduced password complexity lowers resistance to dictionary attacks.",
  },
  {
    key: "login/min_password_letters",
    label: "Minimum letters",
    unit: "letters",
    dir: "min",
    severity: "Low",
    syn: ["letters", "alphabetic"],
    exclude: ["upper", "lower", "capital"],
    risk: "Reduced password complexity lowers resistance to dictionary attacks.",
  },
  {
    key: "login/min_password_diff",
    label: "Characters different from previous password",
    unit: "characters",
    dir: "min",
    severity: "Low",
    syn: ["differ", "different from the previous"],
    risk: "Users can make trivial changes to an existing password, weakening periodic password change.",
  },
  {
    key: "login/password_history_size",
    label: "Password history size",
    unit: "passwords",
    dir: "min",
    severity: "Medium",
    syn: ["history", "reuse", "remember", "previous passwords"],
    risk: "Users can cycle back to recently used (and possibly compromised) passwords.",
  },
  {
    key: "login/fails_to_user_lock",
    label: "Failed logon attempts before lock",
    unit: "attempts",
    dir: "max",
    severity: "High",
    zeroDisables: true,
    syn: ["failed", "invalid attempt", "unsuccessful", "lock"],
    exclude: ["inactivity", "idle"],
    risk: "A high lock threshold allows repeated password guessing against user accounts without detection.",
  },
  {
    key: "login/password_expiration_time",
    label: "Password expiry",
    unit: "days",
    dir: "max",
    severity: "Medium",
    zeroDisables: true,
    zeroMeaning: "0 = passwords never expire",
    syn: ["expir", "change password every", "validity", "changed every"],
    exclude: ["initial", "idle", "not used", "unused"],
    risk: "Passwords that are not changed periodically remain usable indefinitely if compromised.",
  },
  {
    key: "login/password_max_idle_initial",
    label: "Validity of unused initial passwords",
    unit: "days",
    dir: "max",
    severity: "Medium",
    zeroDisables: true,
    zeroMeaning: "0 = initial passwords never expire",
    syn: ["initial password"],
    risk: "Unused initial passwords set by administrators remain valid and can be used by someone other than the intended user.",
  },
  {
    key: "login/password_max_idle_productive",
    label: "Validity of unused productive passwords",
    unit: "days",
    dir: "max",
    severity: "Medium",
    zeroDisables: true,
    zeroMeaning: "0 = unused passwords never expire",
    syn: ["unused password", "not logged on", "dormant"],
    risk: "Dormant accounts keep working passwords, increasing the attack surface.",
  },
  {
    key: "rdisp/gui_auto_logout",
    label: "Automatic logout of idle SAP GUI sessions",
    unit: "seconds",
    dir: "max",
    severity: "Medium",
    zeroDisables: true,
    zeroMeaning: "0 = idle sessions are never logged out",
    syn: ["idle session", "inactivity", "session timeout", "auto logout", "logged out automatically", "automatically logged out"],
    risk: "Unattended sessions remain open and can be misused by someone with physical access to the workstation.",
  },
  {
    key: "login/no_automatic_user_sapstar",
    label: "Automatic SAP* user disabled",
    unit: "",
    dir: "eq",
    severity: "High",
    syn: ["sap*", "sapstar", "emergency user"],
    risk: "If enabled, the hard-coded SAP* user can log on with a known password after its master record is deleted.",
  },
];

export const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fourteen: 14, fifteen: 15, twenty: 20, thirty: 30, sixty: 60, ninety: 90,
};

export const OPS = { min: "≥", max: "≤", eq: "=" };
export const OP_WORDS = { min: "at least", max: "at most", eq: "exactly" };

export function findParameter(key) {
  return PARAMETERS.find((p) => p.key === String(key).toLowerCase()) || null;
}

// Human-friendly value, e.g. 900 seconds -> "900 s (15 min)".
export function formatValue(value, unit) {
  if (value === null || value === undefined || value === "") return "–";
  if (unit === "seconds" && typeof value === "number" && value >= 60 && value % 60 === 0)
    return `${value} s (${value / 60} min)`;
  return String(value);
}
