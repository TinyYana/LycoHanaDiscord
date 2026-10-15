// Local admin panel. No visible text lives here: every string comes from the
// messages file through /api/bootstrap (keys under `admin.`) or from API data.
(function () {
  "use strict";

  const state = {
    text: {},
    fields: [],
    csrf: "",
    guilds: [],
    guildId: "",
    lastSweep: null,
    candidates: [],
    counts: {},
    actionFilter: "",
    /** Score meter scale: the thresholds and the right edge of the track. */
    scale: { high: null, low: null, max: 1 },
  };
  const $ = (id) => document.getElementById(id);

  /** Status strip groups (by RUNTIME_METRICS id) and which values read as good/bad. */
  const METRIC_GROUPS = [
    { key: "admin.status.group.discord", ids: ["discordReady", "discordPing", "guilds"] },
    { key: "admin.status.group.sweep", ids: ["lastSweepStatus", "lastSweepAt"] },
    { key: "admin.status.group.totals", ids: ["sweepGranted", "sweepRevoked", "sweepFailed"] },
  ];
  const METRIC_TONES = {
    discordReady: (v) => (v === "yes" ? "good" : "bad"),
    lastSweepStatus: (v) => ({ ok: "good", failed: "bad", skipped: "warn" })[v] || "",
    sweepFailed: (v) => (Number(v) > 0 ? "bad" : ""),
  };
  /** Most consequential first: what the next sweep would change. */
  const ACTION_ORDER = ["revoke", "grant", "hold", "skip"];
  const ACTION_TONES = { grant: "good", revoke: "bad", hold: "info", skip: "muted" };

  const has = (key) => Object.hasOwn(state.text, key);

  function t(key, params) {
    const raw = has(key) ? state.text[key] : key;
    if (!params) return raw;
    return raw.replace(/\{(\w+)\}/g, (match, name) =>
      name in params ? String(params[name]) : match,
    );
  }

  function el(tag, props, children) {
    const node = Object.assign(document.createElement(tag), props);
    if (children) node.append(...children.filter((child) => child !== ""));
    return node;
  }

  const fallbackError = (key) => ({ ok: false, error: { text: t(key) }, fieldErrors: [] });

  async function api(path, options) {
    let res;
    try {
      res = await fetch(path, options);
    } catch {
      return fallbackError("admin.error.network");
    }
    try {
      return await res.json();
    } catch {
      return fallbackError("admin.error.internal");
    }
  }

  function showBanner(box, tone, text) {
    box.className = "banner tone-" + tone;
    box.textContent = text;
    box.hidden = !text;
  }

  const showGlobalError = (data) => showBanner($("global-error"), "bad", data.error.text);

  function applyStaticText() {
    document.documentElement.lang = t("admin.meta.lang");
    document.title = t("admin.title.page");
    document.querySelectorAll("[data-text]").forEach((n) => (n.textContent = t(n.dataset.text)));
    document
      .querySelectorAll("[data-placeholder]")
      .forEach((n) => (n.placeholder = t(n.dataset.placeholder)));
    $("action-filters").setAttribute("aria-label", t("admin.preview.filterLabel"));
  }

  const isIsoTime = (value) => /^\d{4}-\d\d-\d\dT/.test(String(value));
  const localTime = (iso) =>
    new Date(iso).toLocaleString(t("admin.meta.lang"), { dateStyle: "short", timeStyle: "short" });

  // ---- status strip (RUNTIME_METRICS, grouped) ----

  function metricValue(m) {
    if (isIsoTime(m.value)) return localTime(m.value);
    const word = "admin.metricValue." + m.value;
    const value = has(word) ? t(word) : String(m.value);
    return m.unit ? value + " " + m.unit : value;
  }

  function metricItem(m) {
    const tone = METRIC_TONES[m.id] ? METRIC_TONES[m.id](String(m.value)) : "";
    const label = has("admin.metric." + m.id) ? t("admin.metric." + m.id) : m.name;
    return el("div", { className: "metric metric-" + m.id }, [
      el("dt", { textContent: label }),
      el("dd", { className: tone ? "tone-text-" + tone : "", textContent: metricValue(m) }),
    ]);
  }

  function renderMetrics(metrics) {
    const byId = new Map(metrics.map((m) => [m.id, m]));
    const known = new Set(METRIC_GROUPS.flatMap((g) => g.ids));
    const groups = METRIC_GROUPS.map((g) => ({
      key: g.key,
      ids: g.ids.filter((id) => byId.has(id)),
    }));
    const rest = metrics.filter((m) => !known.has(m.id)).map((m) => m.id);
    if (rest.length) groups.push({ key: "", ids: rest });
    $("metrics").replaceChildren(
      ...groups.map((g) =>
        el("div", { className: "status-group" }, [
          el("h3", { className: "group-title", textContent: g.key ? t(g.key) : "" }),
          el(
            "dl",
            {},
            g.ids.map((id) => metricItem(byId.get(id))),
          ),
        ]),
      ),
    );
  }

  async function loadStatus() {
    const data = await api("/api/status");
    if (!data.ok) return showGlobalError(data);
    renderMetrics(data.metrics);
    state.lastSweep = data.lastSweep;
    const reason = data.lastSweep && data.lastSweep.reasonText;
    $("sweep-note").textContent = reason ? t("admin.status.sweepReason", { reason }) : "";
    $("sweep-note").hidden = !reason;
  }

  // ---- guild switch ----

  function renderGuildTabs() {
    $("guild-tabs").replaceChildren(
      ...state.guilds.map((g) => {
        const button = el("button", {
          type: "button",
          className: "guild-tab",
          textContent: g.name,
        });
        if (g.id === state.guildId) button.setAttribute("aria-current", "true");
        button.addEventListener("click", () => selectGuild(g.id));
        return button;
      }),
    );
  }

  function guildSweepText() {
    const sweep = state.lastSweep;
    const result = sweep && sweep.guilds.find((g) => g.guildId === state.guildId);
    if (!result) return t("admin.guild.noSweep");
    const line = t("admin.guild.lastSweep", {
      ...result,
      status: t("admin.sweepStatus." + result.status),
    });
    if (!result.reasonText) return line;
    return line + "\n" + t("admin.guild.lastSweepReason", { reason: result.reasonText });
  }

  function renderGuildHead() {
    const guild = state.guilds.find((g) => g.id === state.guildId);
    $("guild-name").textContent = guild ? guild.name : "";
    $("guild-sweep").textContent = guildSweepText();
  }

  // ---- settings form (built from the domain's setting field table) ----

  function fieldInput(field) {
    const errorId = "error-" + field.key;
    const input = el("input", { type: "number", id: "field-" + field.key, step: "1" });
    input.setAttribute("inputmode", "numeric");
    input.setAttribute("aria-describedby", errorId);
    // Skip the description when the messages file just repeats the label.
    const parts = field.description === field.label ? [] : [field.description];
    if (field.nullable) parts.push(t("admin.settings.nullableHint"));
    return el("div", { className: "field" }, [
      el("label", { htmlFor: input.id, textContent: field.label }),
      input,
      parts.length ? el("small", { className: "hint", textContent: parts.join("\n") }) : "",
      el("span", { className: "field-error", id: errorId }),
    ]);
  }

  function buildForm() {
    for (const field of state.fields) $("group-" + field.group).append(fieldInput(field));
  }

  const settingValue = (settings, field) =>
    field.group === "weights" ? settings.weights[field.key] : settings[field.key];

  const roleLabel = (role) =>
    role.managed ? role.name + " " + t("admin.settings.managedRole") : role.name;

  function exemptCheckbox(role, checked) {
    const box = el("input", { type: "checkbox", value: role.id, checked });
    return el("label", { className: "check" }, [box, el("span", { textContent: roleLabel(role) })]);
  }

  function renderWarnings(warnings) {
    $("settings-warning-list").replaceChildren(
      ...warnings.map((text) => el("li", { textContent: text })),
    );
    $("settings-warnings").hidden = warnings.length === 0;
  }

  /** Repaint the form from a server view (always the stored, read-back values). */
  function fillForm(view) {
    const { settings, roles } = view;
    $("role").replaceChildren(
      el("option", { value: "", textContent: t("admin.settings.roleNone") }),
      ...roles.map((role) => el("option", { value: role.id, textContent: roleLabel(role) })),
    );
    $("role").value = settings.activeMemberRoleId ?? "";
    for (const field of state.fields) {
      $("field-" + field.key).value = settingValue(settings, field) ?? "";
    }
    $("exempt").replaceChildren(
      ...roles.map((role) => exemptCheckbox(role, settings.exemptRoleIds.includes(role.id))),
    );
    renderWarnings(view.warnings);
  }

  const numberOrNull = (raw) => (raw.trim() === "" ? null : Number(raw));

  function readForm() {
    const body = {
      activeMemberRoleId: $("role").value || null,
      weights: {},
      exemptRoleIds: [...document.querySelectorAll("#exempt input:checked")].map((i) => i.value),
    };
    for (const field of state.fields) {
      const target = field.group === "weights" ? body.weights : body;
      target[field.key] = numberOrNull($("field-" + field.key).value);
    }
    return body;
  }

  function clearFieldErrors() {
    document.querySelectorAll(".field-error").forEach((n) => (n.textContent = ""));
    document.querySelectorAll("[aria-invalid]").forEach((n) => n.removeAttribute("aria-invalid"));
  }

  /** Inputs that carry a field error's highlight (role select / exempt list / number). */
  const fieldControl = (field) =>
    ({ activeMemberRoleId: $("role"), exemptRoleIds: $("exempt") })[field] || $("field-" + field);

  /** Per-field messages next to their inputs; returns form-level ones. */
  function showFieldErrors(fieldErrors) {
    const formLevel = [];
    for (const error of fieldErrors) {
      const slot = error.field && $("error-" + error.field);
      if (!slot) {
        formLevel.push(error.text);
        continue;
      }
      slot.textContent = error.text;
      const control = fieldControl(error.field);
      if (control) control.setAttribute("aria-invalid", "true");
    }
    return formLevel;
  }

  async function loadConfig() {
    const data = await api("/api/guilds/" + state.guildId + "/config");
    if (!data.ok) return showGlobalError(data);
    fillForm(data);
  }

  async function save(event) {
    event.preventDefault();
    clearFieldErrors();
    const result = $("settings-result");
    showBanner(result, "info", t("admin.save.saving"));
    $("save").disabled = true;
    const data = await api("/api/guilds/" + state.guildId + "/config", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": state.csrf },
      body: JSON.stringify(readForm()),
    });
    $("save").disabled = false;
    if (!data.ok) {
      const formLevel = showFieldErrors(data.fieldErrors || []);
      showBanner(result, "bad", [data.error.text, ...formLevel].join("\n"));
      return;
    }
    fillForm(data);
    showBanner(result, "good", data.message);
    loadPreview();
  }

  // ---- preview (read-only) ----

  const shown = (value) => (value == null ? t("admin.value.unset") : value);

  function previewAlert(p) {
    if (p.skipText) return t("admin.preview.skipped", { reason: p.skipText });
    if (p.revokeDisabledText) {
      return t("admin.preview.revokeDisabled", { reason: p.revokeDisabledText });
    }
    return "";
  }

  function fact(key, value, extraClass) {
    const unset = value == null;
    const className = ["fact", extraClass, unset ? "is-unset" : ""].filter(Boolean).join(" ");
    return el("div", { className }, [
      el("dt", { textContent: t(key) }),
      el("dd", { textContent: shown(value) }),
    ]);
  }

  function renderFacts(p) {
    $("preview-facts").replaceChildren(
      fact("admin.preview.fact.role", p.roleName, "fact-role"),
      fact("admin.preview.fact.high", p.high, "fact-num"),
      fact("admin.preview.fact.low", p.low, "fact-num" + (p.revokeDisabledText ? " is-warn" : "")),
      fact("admin.preview.fact.window", t("admin.preview.windowValue", p.window), "fact-window"),
    );
    showBanner($("preview-alert"), "warn", previewAlert(p));
  }

  function filterButton(action, label, count) {
    const button = el("button", { type: "button", className: "seg" }, [
      el("span", { textContent: label }),
      el("span", { className: "seg-count", textContent: String(count) }),
    ]);
    if (action) button.dataset.tone = ACTION_TONES[action];
    button.setAttribute("aria-pressed", String(state.actionFilter === action));
    button.addEventListener("click", () => {
      state.actionFilter = action;
      renderActionFilters();
      renderCandidates();
    });
    return button;
  }

  function renderActionFilters() {
    $("action-filters").replaceChildren(
      filterButton("", t("admin.preview.filterAll"), state.candidates.length),
      ...ACTION_ORDER.map((a) => filterButton(a, t("admin.action." + a), state.counts[a] || 0)),
    );
  }

  const tag = (text, tone) => el("span", { className: "tag tone-" + tone, textContent: text });

  function cell(labelKey, className, children) {
    const td = el("td", { className }, children);
    td.dataset.label = t(labelKey);
    return td;
  }

  /** Decorative score track with low/high ticks; the number beside it carries the value. */
  function scoreMeter(score) {
    const { high, low, max } = state.scale;
    const meter = el("span", { className: "meter" });
    meter.setAttribute("aria-hidden", "true");
    const at = (value) => String(Math.min(1, Math.max(0, value / max)));
    meter.style.setProperty("--fill", at(score));
    if (low != null) meter.style.setProperty("--low", at(low));
    else meter.classList.add("no-low");
    if (high != null) meter.style.setProperty("--high", at(high));
    else meter.classList.add("no-high");
    return meter;
  }

  function candidateRow(c) {
    const roleTags = [
      c.hasRole ? tag(t("admin.preview.tag.hasRole"), "info") : "",
      c.exempt ? tag(t("admin.preview.tag.exempt"), "muted") : "",
    ];
    return el("tr", { className: "row-" + c.action }, [
      cell("admin.preview.col.action", "action", [tag(c.actionText, ACTION_TONES[c.action])]),
      cell("admin.preview.col.user", "user", [
        el("span", { className: "user-name", textContent: c.displayName || c.userId }),
        el("span", { className: "user-id", textContent: c.userId }),
      ]),
      cell("admin.preview.col.score", "num score", [
        scoreMeter(c.score),
        el("span", { className: "score-value", textContent: String(c.score) }),
      ]),
      cell("admin.preview.col.role", "tags", roleTags),
      cell("admin.preview.col.reason", "reason", [c.reasonText]),
    ]);
  }

  function matches(c, query) {
    if (state.actionFilter && c.action !== state.actionFilter) return false;
    if (!query) return true;
    return c.userId.includes(query) || (c.displayName || "").toLowerCase().includes(query);
  }

  function renderCandidates() {
    const query = $("filter").value.trim().toLowerCase();
    const rows = state.candidates.filter((c) => matches(c, query));
    $("candidates").replaceChildren(...rows.map(candidateRow));
    $("candidates-empty").hidden = rows.length > 0;
  }

  const byConsequence = (a, b) =>
    ACTION_ORDER.indexOf(a.action) - ACTION_ORDER.indexOf(b.action) || b.score - a.score;

  async function loadPreview() {
    const alert = $("preview-alert");
    showBanner(alert, "info", t("admin.preview.loading"));
    const data = await api("/api/guilds/" + state.guildId + "/preview");
    if (!data.ok) {
      showBanner(alert, "bad", data.error.text);
      return;
    }
    state.candidates = data.candidates.slice().sort(byConsequence);
    state.counts = data.counts;
    const scores = data.candidates.map((c) => c.score);
    const top = Math.max(1, ...scores, (data.high ?? 0) * 1.25, (data.low ?? 0) * 1.25);
    state.scale = { high: data.high, low: data.low, max: top };
    renderFacts(data);
    renderActionFilters();
    renderCandidates();
  }

  // ---- wiring ----

  async function selectGuild(guildId) {
    state.guildId = guildId;
    state.actionFilter = "";
    $("guild-panels").hidden = !guildId;
    showBanner($("settings-result"), "info", "");
    clearFieldErrors();
    renderGuildTabs();
    renderGuildHead();
    if (guildId) await Promise.all([loadConfig(), loadPreview()]);
  }

  async function loadGuilds() {
    const data = await api("/api/guilds");
    if (!data.ok) return showGlobalError(data);
    state.guilds = data.guilds;
    $("no-guilds").hidden = data.guilds.length > 0;
    const keep = data.guilds.some((g) => g.id === state.guildId);
    await selectGuild(keep ? state.guildId : data.guilds[0]?.id || "");
  }

  async function refresh() {
    showBanner($("global-error"), "bad", "");
    await loadStatus();
    await loadGuilds();
  }

  async function start() {
    const data = await api("/api/bootstrap");
    if (!data.ok) return showGlobalError(data);
    state.text = data.text;
    state.fields = data.settingFields;
    state.csrf = data.csrfToken;
    applyStaticText();
    buildForm();
    $("refresh").addEventListener("click", refresh);
    $("reload-preview").addEventListener("click", loadPreview);
    $("filter").addEventListener("input", renderCandidates);
    $("settings-form").addEventListener("submit", save);
    await refresh();
  }

  start();
})();
