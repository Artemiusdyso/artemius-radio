(() => {
  const cfg = window.ARTEMIUS_RADIO_CONFIG || {};
  const audio = document.getElementById("audio-player");
  const playBtn = document.getElementById("play-toggle");
  const seek = document.getElementById("seek");
  const volume = document.getElementById("volume");
  const title = document.getElementById("now-title");
  const artist = document.getElementById("now-artist");
  const cover = document.getElementById("now-cover");
  const message = document.getElementById("player-message");
  const list = document.getElementById("track-list");
  const count = document.getElementById("track-count");
  const allTracksBtn = document.getElementById("all-tracks");
  const library = document.getElementById("library");
  library.classList.add("library-hidden-until-open");
  const fmt = s => { if (!Number.isFinite(s)) return "00:00"; const m=Math.floor(s/60); return String(m).padStart(2,"0")+":"+String(Math.floor(s%60)).padStart(2,"0"); };
  let tracks = [], current = -1, supabase = null;

  const analyticsConsentKey = "artemius_radio_analytics_consent_v1";
  const analyticsParams = new URLSearchParams(window.location.search);
  if (analyticsParams.get("analytics") === "setup") {
    try { window.localStorage.removeItem(analyticsConsentKey); } catch (_) {}
  }
  let analyticsConsent = false;
  let analyticsSessionId = null, analyticsTrackId = null, analyticsIsPlaying = false, analyticsHeartbeat = null;
  let analyticsStoredChoice = null;
  try {
    analyticsStoredChoice = window.localStorage.getItem(analyticsConsentKey);
    analyticsConsent = analyticsStoredChoice === "accepted";
  } catch (_) {}

  function analyticsRequest(action, sessionId, trackId) {
    if (!analyticsConsent || !cfg.supabaseUrl || !cfg.supabaseAnonKey || !sessionId) {
      console.debug("Artemius Radio analytics skipped:", {
        consent: analyticsConsent,
        configured: !!(cfg.supabaseUrl && cfg.supabaseAnonKey),
        action
      });
      return;
    }
    fetch(cfg.supabaseUrl + "/functions/v1/radio-analytics", {
      method: "POST",
      headers: {
        "apikey": cfg.supabaseAnonKey,
        "Authorization": "Bearer " + cfg.supabaseAnonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action, sessionId, trackId: trackId || null }),
      keepalive: action === "stop" || action === "ended"
    }).then(async response => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) {
        console.warn("Artemius Radio analytics response:", response.status, result);
      } else {
        console.debug("Artemius Radio analytics event recorded:", action);
      }
    }).catch(error => console.warn("Artemius Radio analytics request failed:", error));
  }

  function clearAnalyticsHeartbeat() {
    if (analyticsHeartbeat) window.clearInterval(analyticsHeartbeat);
    analyticsHeartbeat = null;
  }

  function beginAnalytics() {
    if (!analyticsConsent || !supabase || current < 0 || !tracks[current]) return;
    const track = tracks[current];
    if (!track.id) return;

    if (analyticsSessionId && analyticsTrackId === track.id) {
      if (!analyticsIsPlaying) {
        analyticsIsPlaying = true;
        analyticsRequest("resume", analyticsSessionId, analyticsTrackId);
      }
    } else {
      if (analyticsSessionId) finishAnalytics("stop");
      analyticsSessionId = crypto.randomUUID();
      analyticsTrackId = track.id;
      analyticsIsPlaying = true;
      analyticsRequest("start", analyticsSessionId, analyticsTrackId);
    }

    if (!analyticsHeartbeat) {
      analyticsHeartbeat = window.setInterval(() => {
        if (analyticsIsPlaying && !audio.paused) {
          analyticsRequest("heartbeat", analyticsSessionId, analyticsTrackId);
        }
      }, 15000);
    }
  }

  function pauseAnalytics() {
    if (!analyticsSessionId || !analyticsIsPlaying) return;
    analyticsIsPlaying = false;
    clearAnalyticsHeartbeat();
    analyticsRequest("pause", analyticsSessionId, analyticsTrackId);
  }

  function finishAnalytics(action) {
    if (!analyticsSessionId) return;
    const oldSessionId = analyticsSessionId;
    const oldTrackId = analyticsTrackId;
    analyticsSessionId = null;
    analyticsTrackId = null;
    analyticsIsPlaying = false;
    clearAnalyticsHeartbeat();
    analyticsRequest(action || "stop", oldSessionId, oldTrackId);
  }

  function sendAnalyticsOnPageExit() {
    if (!analyticsConsent || !analyticsSessionId || !cfg.supabaseUrl || !cfg.supabaseAnonKey) return;
    const payload = JSON.stringify({
      action: "stop",
      sessionId: analyticsSessionId,
      trackId: analyticsTrackId
    });
    fetch(cfg.supabaseUrl + "/functions/v1/radio-analytics", {
      method: "POST",
      headers: {
        "apikey": cfg.supabaseAnonKey,
        "Authorization": "Bearer " + cfg.supabaseAnonKey,
        "Content-Type": "application/json"
      },
      body: payload,
      keepalive: true
    }).catch(() => {});
    analyticsSessionId = null;
    analyticsTrackId = null;
    analyticsIsPlaying = false;
    clearAnalyticsHeartbeat();
  }

  function showAnalyticsConsent() {
    if (analyticsStoredChoice === "accepted" || analyticsStoredChoice === "refused") return;
    const banner = document.createElement("aside");
    banner.className = "analytics-consent";
    banner.setAttribute("aria-label", "Analytics consent");
    banner.innerHTML =
      '<div class="analytics-consent-copy"><strong>Help improve Artemius Radio</strong>' +
      '<p>Allow anonymous listening statistics (listening time and approximate country). We do not save IP addresses in the analytics database.</p>' +
      '<a href="privacy.html">Privacy details</a></div>' +
      '<div class="analytics-consent-actions"><button type="button" class="analytics-accept">Accept</button>' +
      '<button type="button" class="analytics-refuse">Refuse</button></div>';
    document.body.appendChild(banner);

    function choose(accepted) {
      try {
        window.localStorage.setItem(analyticsConsentKey, accepted ? "accepted" : "refused");
      } catch (_) {}
      analyticsStoredChoice = accepted ? "accepted" : "refused";
      if (accepted) {
        analyticsConsent = true;
        if (!audio.paused) beginAnalytics();
      } else {
        if (analyticsSessionId) finishAnalytics("stop");
        analyticsConsent = false;
      }
      banner.remove();
    }
    banner.querySelector(".analytics-accept").addEventListener("click", () => choose(true));
    banner.querySelector(".analytics-refuse").addEventListener("click", () => choose(false));
  }

  showAnalyticsConsent();
  window.addEventListener("pagehide", sendAnalyticsOnPageExit);
  document.getElementById("year").textContent = new Date().getFullYear();
  message.textContent = "Mobile diagnostic v5 loaded — connecting to library…";
  audio.volume = Number(volume.value);
  volume.addEventListener("input", () => audio.volume = Number(volume.value));
  function setPlaying(playing){
    playBtn.textContent=playing?"Ⅱ":"▶";
    playBtn.setAttribute("aria-label",playing?"Pause":"Play");
    const card=document.querySelector(".player-card");
    if(card) card.classList.toggle("is-playing",playing);
    document.body.classList.toggle("radio-playing",playing);
  }
  function play(index){
    if (!tracks.length) {
      // Keep the diagnostic visible; repeated taps must not overwrite it or start duplicate requests.
      if (!/error|unavailable|failed|network/i.test(message.textContent)) {
        message.textContent = "Library is still loading. If this message remains, reload the page once.";
      }
      return;
    }
    current = (index + tracks.length) % tracks.length;
    const t = tracks[current];
    finishAnalytics("stop");
    setPlaying(false);
    audio.pause();
    audio.src = t.audio_url;
    audio.volume = Number(volume.value);
    title.textContent = t.title;
    artist.textContent = t.artist || "Artemius Radio";
    cover.src = t.cover_url || "assets/cover-placeholder.svg";
    document.querySelectorAll(".track-row").forEach((el, i) => el.classList.toggle("current", i === current));
    message.textContent = "Loading track…";
    const attempt = audio.play();
    if (attempt && typeof attempt.then === "function") {
      attempt.then(() => {
        if (!audio.paused) {
          setPlaying(true);
          message.textContent = "Now playing";
        }
      }).catch(e => {
        setPlaying(false);
        message.textContent = e && e.name === "NotAllowedError"
          ? "Tap Play once more to allow audio playback."
          : "Playback failed. Check your connection or audio file.";
        console.warn("Artemius Radio playback error:", e, audio.error);
      });
    }
  }
  playBtn.addEventListener("click", () => {
    if (!audio.paused && !audio.ended) {
      audio.pause();
      setPlaying(false);
      pauseAnalytics();
      message.textContent = "Playback paused";
      return;
    }
    if (current < 0) {
      play(0);
      return;
    }
    const attempt = audio.play();
    if (attempt && typeof attempt.then === "function") {
      attempt.then(() => {
        setPlaying(true);
        message.textContent = "Now playing";
      }).catch(e => {
        setPlaying(false);
        message.textContent = e && e.name === "NotAllowedError"
          ? "Tap Play once more to allow audio playback."
          : "Playback failed. Check your connection or audio file.";
        console.warn("Artemius Radio playback error:", e, audio.error);
      });
    }
  });
  function playRandomNext(){
    if (tracks.length < 2) { if (tracks.length === 1) play(0); return; }
    const choices = tracks.map((_, i) => i).filter(i => i !== current);
    play(choices[Math.floor(Math.random() * choices.length)]);
  }
  document.getElementById("prev-track").addEventListener("click",()=>tracks.length&&play(current<=0?tracks.length-1:current-1));
  document.getElementById("next-track").addEventListener("click",playRandomNext);
  if (allTracksBtn) {
    allTracksBtn.setAttribute("aria-expanded", "false");
    allTracksBtn.addEventListener("click", () => {
      const isOpen = !library.classList.contains("library-hidden-until-open");
      if (isOpen) {
        library.classList.add("library-hidden-until-open");
        allTracksBtn.classList.remove("active");
        allTracksBtn.setAttribute("aria-pressed", "false");
        allTracksBtn.setAttribute("aria-expanded", "false");
        allTracksBtn.textContent = "All tracks";
      } else {
        library.classList.remove("library-hidden-until-open");
        allTracksBtn.classList.add("active");
        allTracksBtn.setAttribute("aria-pressed", "true");
        allTracksBtn.setAttribute("aria-expanded", "true");
        library.scrollIntoView({ behavior: "auto", block: "start" });
        list.classList.remove("tracks-highlight");
        void list.offsetWidth;
        list.classList.add("tracks-highlight");
        allTracksBtn.textContent = "Hide tracks ✕";
        window.setTimeout(() => list.classList.remove("tracks-highlight"), 1800);
      }
    });
  }
  audio.addEventListener("timeupdate",()=>{seek.value=audio.duration?audio.currentTime/audio.duration*100:0;document.getElementById("current-time").textContent=fmt(audio.currentTime);document.getElementById("duration").textContent=fmt(audio.duration);});
  seek.addEventListener("input",()=>{if(audio.duration)audio.currentTime=Number(seek.value)/100*audio.duration;});
  audio.addEventListener("playing",()=>{setPlaying(true);message.textContent="Now playing";beginAnalytics();});
  audio.addEventListener("waiting",()=>{message.textContent="Buffering audio…";});
  audio.addEventListener("ended",()=>finishAnalytics("ended"));
  audio.addEventListener("ended",playRandomNext);
  audio.addEventListener("error",()=>{finishAnalytics("stop");setPlaying(false);const err=audio.error;message.textContent=err?"Audio error ("+err.code+"). Try another track or reload the page.":"This file cannot be played. Please check your connection.";console.warn("Artemius Radio audio element error:",err);});
  function render(){
    count.textContent=tracks.length+" TRACK"+(tracks.length>1?"S":"");
    if(!tracks.length){list.innerHTML='<div class="empty-state"><div class="empty-icon">♫</div><h3>The silence before the first note.</h3><p>Add tracks through the Admin Studio. They will appear here as soon as they are published.</p></div>';return;}
    list.innerHTML="";
    tracks.forEach((t,i)=>{const row=document.createElement("button");row.type="button";row.className="track-row";row.setAttribute("aria-label","Listen to "+t.title);
      const img=document.createElement("img");img.className="track-thumb";img.src=t.cover_url||"assets/cover-placeholder.svg";img.alt="";
      const info=document.createElement("span");info.className="track-info";const strong=document.createElement("strong");strong.textContent=t.title;const sub=document.createElement("span");sub.textContent=t.artist||"Artemius";info.append(strong,sub);
      const tag=document.createElement("span");tag.className="track-tag";tag.textContent=t.genre||"ORIGINAL";
      const play=document.createElement("span");play.className="track-play";play.textContent="▶";play.setAttribute("aria-hidden","true");row.append(img,info,tag,play);row.addEventListener("click",()=>playTrack(i));list.append(row);
    });
  }
  function playTrack(i){play(i);}
  async function load(){
    if(!cfg.supabaseUrl||!cfg.supabaseAnonKey){message.textContent="Radio configuration is missing.";return;}
    if(!window.supabase){
      message.textContent="Connecting to the audio library…";
      if(!window.__artemiusSupabaseLoading){
        window.__artemiusSupabaseLoading=true;
        const script=document.createElement("script");
        script.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        script.onload=()=>{window.__artemiusSupabaseLoading=false;load();};
        script.onerror=()=>{window.__artemiusSupabaseLoading=false;message.textContent="Audio library unavailable. Check your connection and reload.";};
        document.head.appendChild(script);
      }
      return;
    }
    supabase=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
    try {
      const {data,error}=await supabase.from("radio_tracks").select("id,title,artist,genre,audio_path,cover_path,duration_seconds,created_at").eq("is_published",true).order("sort_order",{ascending:true}).order("created_at",{ascending:false});
      if(error){
        console.error("Artemius Radio library query failed:",error);
        const detail=[error.code,error.message].filter(Boolean).join(" — ");
        message.textContent="Library connection error: "+(detail||"request failed")+".";
        return;
      }
      tracks=(data||[]).map(t=>({...t,audio_url:supabase.storage.from(cfg.audioBucket||"radio-audio").getPublicUrl(t.audio_path).data.publicUrl,cover_url:t.cover_path?supabase.storage.from(cfg.coversBucket||"radio-covers").getPublicUrl(t.cover_path).data.publicUrl:null}));
      render(); message.textContent=tracks.length?"Ready to stream your creations.":"The Studio has not published any tracks yet.";
    } catch(e) {
      console.error("Artemius Radio library request crashed:",e);
      message.textContent="Library network error: "+((e&&e.message)||"check your mobile connection")+".";
    }
  }
  render(); load();
})();

  // Subtle cinematic interaction: gentle pointer glow, reduced-motion aware.
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const playerCard = document.querySelector(".player-card");
    if (playerCard) {
      playerCard.addEventListener("pointermove", event => {
        const rect = playerCard.getBoundingClientRect();
        playerCard.style.setProperty("--pointer-x", ((event.clientX - rect.left) / rect.width * 100) + "%");
        playerCard.style.setProperty("--pointer-y", ((event.clientY - rect.top) / rect.height * 100) + "%");
      });
    }
  }
