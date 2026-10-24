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
  const fmt = s => { if (!Number.isFinite(s)) return "00:00"; const m=Math.floor(s/60); return String(m).padStart(2,"0")+":"+String(Math.floor(s%60)).padStart(2,"0"); };
  let tracks = [], current = -1, supabase = null;
  document.getElementById("year").textContent = new Date().getFullYear();
  audio.volume = Number(volume.value);
  volume.addEventListener("input", () => audio.volume = Number(volume.value));
  function setPlaying(playing){
    playBtn.textContent=playing?"Ⅱ":"▶";
    playBtn.setAttribute("aria-label",playing?"Pause":"Play");
    const card=document.querySelector(".player-card");
    if(card) card.classList.toggle("is-playing",playing);
    document.body.classList.toggle("radio-playing",playing);
  }
  async function play(index){
    if (!tracks.length) { message.textContent="The library will be available once the Studio is configured."; return; }
    current=(index+tracks.length)%tracks.length; const t=tracks[current];
    audio.src=t.audio_url; title.textContent=t.title; artist.textContent=t.artist||"Artemius Radio"; cover.src=t.cover_url||"assets/cover-placeholder.svg";
    document.querySelectorAll(".track-row").forEach((el,i)=>el.classList.toggle("current",i===current));
    message.textContent="Loading track…";
    try { await audio.play(); setPlaying(true); message.textContent="Now playing"; } catch(e) { setPlaying(false); message.textContent="Press Play to start listening."; }
  }
  playBtn.addEventListener("click",()=>{if(audio.paused){if(current<0){play(0)}else{audio.play().then(()=>setPlaying(true)).catch(()=>message.textContent="Unable to play this file.");}}else{audio.pause();setPlaying(false);}});
  document.getElementById("prev-track").addEventListener("click",()=>tracks.length&&play(current<=0?tracks.length-1:current-1));
  document.getElementById("next-track").addEventListener("click",()=>tracks.length&&play(current+1));
  audio.addEventListener("timeupdate",()=>{seek.value=audio.duration?audio.currentTime/audio.duration*100:0;document.getElementById("current-time").textContent=fmt(audio.currentTime);document.getElementById("duration").textContent=fmt(audio.duration);});
  seek.addEventListener("input",()=>{if(audio.duration)audio.currentTime=Number(seek.value)/100*audio.duration;});
  audio.addEventListener("ended",()=>tracks.length&&play(current+1));
  audio.addEventListener("error",()=>{setPlaying(false);message.textContent="This file cannot be played. Please check its storage.";});
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
    if(!cfg.supabaseUrl||!cfg.supabaseAnonKey||!window.supabase){message.textContent="The player is ready. The database still needs to be connected.";return;}
    supabase=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
    const {data,error}=await supabase.from("radio_tracks").select("id,title,artist,genre,audio_path,cover_path,duration_seconds,created_at").eq("is_published",true).order("sort_order",{ascending:true}).order("created_at",{ascending:false});
    if(error){console.error(error);message.textContent="The library is temporarily unavailable.";return;}
    tracks=(data||[]).map(t=>({...t,audio_url:supabase.storage.from(cfg.audioBucket||"radio-audio").getPublicUrl(t.audio_path).data.publicUrl,cover_url:t.cover_path?supabase.storage.from(cfg.coversBucket||"radio-covers").getPublicUrl(t.cover_path).data.publicUrl:null}));
    render(); message.textContent=tracks.length?"Ready to stream your creations.":"The Studio has not published any tracks yet.";
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
