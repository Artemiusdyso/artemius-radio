(() => {
  const cfg = window.ARTEMIUS_RADIO_CONFIG || {};
  const $ = id => document.getElementById(id);
  const loginPanel = $("login-panel");
  const dashboard = $("dashboard");
  const loginMessage = $("login-message");
  const dashboardMessage = $("dashboard-message");
  const refreshButton = $("refresh-button");
  const logoutButton = $("logout-button");
  let client = null;
  let loading = false;

  function say(element, message, error) {
    element.textContent = message || "";
    element.classList.toggle("error", !!error);
  }

  function formatDuration(seconds) {
    const value = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const secs = Math.floor(value % 60);
    if (hours) return hours + " h " + minutes + " min";
    if (minutes) return minutes + " min " + secs + " s";
    return secs + " s";
  }

  function number(value) {
    return new Intl.NumberFormat("fr-BE").format(Number(value) || 0);
  }

  function countryName(code) {
    if (!code || code === "??") return "Pays inconnu";
    try {
      return new Intl.DisplayNames(["fr"], { type: "region" }).of(code) || code;
    } catch (_) {
      return code;
    }
  }

  function renderDaily(rows) {
    const container = $("daily-chart");
    container.replaceChildren();
    if (!rows || !rows.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Aucune écoute enregistrée pour le moment.";
      container.appendChild(empty);
      return;
    }
    const maximum = Math.max(1, ...rows.map(row => Number(row.plays) || 0));
    rows.forEach((row, index) => {
      const column = document.createElement("div");
      column.className = "day-column";
      const barWrap = document.createElement("div");
      barWrap.className = "day-bar-wrap";
      const bar = document.createElement("div");
      bar.className = "day-bar";
      const plays = Number(row.plays) || 0;
      bar.style.height = Math.max(3, plays / maximum * 100) + "%";
      bar.title = (row.date || "") + " — " + number(plays) + " écoutes";
      barWrap.appendChild(bar);
      const label = document.createElement("span");
      label.className = "day-label";
      const date = new Date(String(row.date) + "T12:00:00");
      label.textContent = (index === 0 || index === rows.length - 1 || index % 5 === 0)
        ? date.toLocaleDateString("fr-BE", { day: "2-digit", month: "2-digit" })
        : "";
      column.append(barWrap, label);
      container.appendChild(column);
    });
  }

  function addRankRow(container, name, meta, value) {
    const row = document.createElement("div");
    row.className = "rank-row";
    const title = document.createElement("span");
    title.className = "rank-name";
    title.textContent = name;
    const details = document.createElement("span");
    details.className = "rank-meta";
    details.textContent = meta;
    const total = document.createElement("strong");
    total.className = "rank-value";
    total.textContent = value;
    row.append(title, details, total);
    container.appendChild(row);
  }

  function renderCountries(rows) {
    const container = $("country-list");
    container.replaceChildren();
    if (!rows || !rows.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Aucun pays détecté pour le moment.";
      container.appendChild(empty);
      return;
    }
    rows.forEach(row => addRankRow(
      container,
      countryName(row.code),
      number(row.plays) + " écoute(s) · " + formatDuration(row.seconds),
      number(row.plays)
    ));
  }

  function renderTracks(rows) {
    const container = $("track-list");
    container.replaceChildren();
    if (!rows || !rows.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Aucun morceau écouté pour le moment.";
      container.appendChild(empty);
      return;
    }
    rows.forEach((row, index) => addRankRow(
      container,
      (index + 1) + ". " + (row.title || "Morceau"),
      (row.artist || "Artemius") + " · " + formatDuration(row.seconds),
      number(row.plays) + " écoutes"
    ));
  }

  function renderStats(data) {
    const summary = data && data.summary ? data.summary : {};
    const plays = Number(summary.total_plays) || 0;
    const seconds = Number(summary.listening_seconds) || 0;
    $("total-plays").textContent = number(plays);
    $("qualified-plays").textContent = number(summary.qualified_plays);
    $("listening-time").textContent = formatDuration(seconds);
    $("average-time").textContent = "Moyenne par écoute : " + formatDuration(plays ? Math.round(seconds / plays) : 0);
    $("active-listeners").textContent = number(summary.active_listeners);
    $("country-count").textContent = number(summary.countries) + " pays";
    renderDaily(data.daily || []);
    renderCountries(data.countries_breakdown || []);
    renderTracks(data.top_tracks || []);
    const stamp = data.last_updated ? new Date(data.last_updated) : new Date();
    $("last-updated").textContent = "Mise à jour : " + stamp.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });
    say(dashboardMessage, "");
  }

  async function loadStats() {
    if (!client || loading) return;
    loading = true;
    refreshButton.disabled = true;
    say(dashboardMessage, "Chargement des statistiques…");
    const { data, error } = await client.rpc("radio_get_stats");
    loading = false;
    refreshButton.disabled = false;
    if (error) {
      say(dashboardMessage, error.message.includes("Not authorized")
        ? "Ce compte n'est pas autorisé à consulter les statistiques."
        : "Impossible de charger les statistiques : " + error.message, true);
      return;
    }
    renderStats(data || {});
  }

  async function applySession(session) {
    const signedIn = !!session;
    loginPanel.hidden = signedIn;
    dashboard.hidden = !signedIn;
    refreshButton.hidden = !signedIn;
    logoutButton.hidden = !signedIn;
    if (signedIn) await loadStats();
  }

  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) {
    say(loginMessage, "La connexion Supabase n'est pas disponible.", true);
    return;
  }

  client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  $("login-form").addEventListener("submit", async event => {
    event.preventDefault();
    say(loginMessage, "Connexion…");
    const { data, error } = await client.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("password").value
    });
    if (error) {
      say(loginMessage, error.message, true);
      return;
    }
    $("password").value = "";
    await applySession(data.session);
  });

  refreshButton.addEventListener("click", loadStats);
  logoutButton.addEventListener("click", async () => {
    await client.auth.signOut();
    await applySession(null);
  });

  client.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => applySession(session), 0);
  });

  client.auth.getSession().then(({ data }) => applySession(data.session));
  window.setInterval(() => {
    if (!dashboard.hidden) loadStats();
  }, 60000);
})();