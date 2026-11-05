// Simulated read-only SAP connector. In production this would call the
// backend, which uses RFC_READ_TABLE (or an OData service) against table PAHI
// with a read-only service account. The demo returns a realistic extract:
// two application server instances, historical (inactive) values, and a few
// deliberately non-compliant settings so the test produces real exceptions.

export const SAP_SYSTEM = {
  sid: "DS4",
  client: "100",
  description: "S/4HANA Finance – Production",
  serviceUser: "AUDIT_RFC",
  table: "PAHI",
  instances: [
    { host: "sapds4ci", name: "sapds4ci_DS4_00" },
    { host: "sapds4app1", name: "sapds4app1_DS4_01" },
  ],
};

export const PAHI_COLUMNS = ["HOSTNAME", "SYSTEMID", "PARDATE", "PARSTATE", "PARNAME", "PARVALUE"];

// Active values per instance. DS4_01 has drifted from DS4_00 for two
// parameters - the kind of finding a single-instance test would miss.
const POLICY_VALUES = {
  "login/min_password_lng": [12, 8],
  "login/min_password_digits": [1, 1],
  "login/min_password_specials": [0, 0],
  "login/min_password_uppercase": [1, 1],
  "login/min_password_lowercase": [1, 1],
  "login/min_password_letters": [1, 1],
  "login/min_password_diff": [3, 3],
  "login/password_history_size": [3, 3],
  "login/fails_to_user_lock": [5, 5],
  "login/password_expiration_time": [90, 0],
  "login/password_max_idle_initial": [14, 14],
  "login/password_max_idle_productive": [180, 180],
  "rdisp/gui_auto_logout": [1800, 1800],
  "login/no_automatic_user_sapstar": [1, 1],
};

// Older values kept by PAHI as inactive history.
const HISTORY = [
  ["login/min_password_lng", 0, 8, "2023-02-11"],
  ["login/min_password_lng", 1, 6, "2023-02-11"],
  ["login/password_expiration_time", 0, 180, "2024-06-03"],
  ["login/fails_to_user_lock", 0, 12, "2022-09-19"],
  ["login/fails_to_user_lock", 1, 12, "2022-09-19"],
  ["rdisp/gui_auto_logout", 0, 3600, "2023-08-30"],
];

const FILLER = [
  "abap/buffersize", "abap/heap_area_dia", "abap/heap_area_nondia", "abap/heap_area_total", "abap/shared_objects_size_MB",
  "auth/rfc_authority_check", "auth/object_disabling_active", "auth/no_check_in_some_cases", "dbs/hdb/schema", "em/initial_size_MB",
  "em/max_size_MB", "enque/table_size", "gw/acl_mode", "gw/reg_no_conn_info", "gw/sec_info", "gw/reg_info", "icm/host_name_full",
  "icm/server_port_0", "icm/server_port_1", "icm/HTTP/logging_0", "login/system_client", "login/accept_sso2_ticket", "login/create_sso2_ticket",
  "ms/server_port_0", "rdisp/max_wprun_time", "rdisp/wp_no_dia", "rdisp/wp_no_btc", "rdisp/wp_no_vb", "rdisp/wp_no_spo", "rdisp/max_alt_modes",
  "rfc/max_comm_entries", "rfc/reject_expired_passwd", "rsau/enable", "rsau/max_diskspace/local", "rsau/selection_slots", "rsdb/ntab/entrycount",
  "rsdb/obj/buffersize", "rsdb/cua/buffersize", "snc/enable", "snc/accept_insecure_gui", "ssl/ciphersuites", "ssl/client_ciphersuites",
  "zcsa/table_buffer_area", "zcsa/presentation_buffer_area", "ztta/roll_area", "ztta/roll_extension", "service/protectedwebmethods", "system/type",
];

function fillerValue(i) {
  return String(((i * 7919) % 4096) + (i % 3 === 0 ? 0 : 128));
}

/**
 * Builds the PAHI extract as returned by the connector, row order as SE16
 * would show it. Each row: { n, host, system, date, state, param, value, active }.
 * `n` is the Excel row number in the exported file (header is row 1).
 */
export function generatePahiExtract() {
  const rows = [];
  SAP_SYSTEM.instances.forEach((inst, ii) => {
    const block = [];
    for (let i = 0; i < 948; i++) {
      const base = FILLER[i % FILLER.length];
      const param = i < FILLER.length ? base : `${base}_${Math.floor(i / FILLER.length)}`;
      block.push({ param, value: fillerValue(i + ii * 31), date: "2025-03-08", state: "A" });
    }
    Object.entries(POLICY_VALUES).forEach(([param, vals], k) => {
      block.splice(60 + k * 61, 0, { param, value: String(vals[ii]), date: "2025-11-14", state: "A" });
    });
    HISTORY.filter((h) => h[1] === ii).forEach(([param, , value, date], k) => {
      block.splice(40 + k * 170, 0, { param, value: String(value), date, state: "I" });
    });
    block.forEach((r) =>
      rows.push({ host: inst.name, system: SAP_SYSTEM.sid, date: r.date, state: r.state, param: r.param, value: r.value })
    );
  });
  return rows.map((r, i) => ({ ...r, n: i + 2, active: r.state === "A" }));
}

// What the SE16 "Number of entries" button shows for PARSTATE = 'A'.
// Queried independently of the extract so the C&A check is meaningful.
export function screenRecordCount(rows) {
  return rows.filter((r) => r.state === "A").length;
}

// Re-reads specific rows from the source for the sample tie-out.
export function requery(rows, sample) {
  return sample.map((s) => rows.find((r) => r.host === s.host && r.param === s.param && r.state === s.state) || null);
}

export function extractToAoa(rows) {
  return [PAHI_COLUMNS, ...rows.map((r) => [r.host, r.system, r.date, r.state, r.param, r.value])];
}
