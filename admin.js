(() => {
 const cfg=window.ARTEMIUS_RADIO_CONFIG||{}, msg=document.getElementById("auth-message"), uploadMsg=document.getElementById("upload-message");
 const authPanel=document.getElementById("auth-panel"), studio=document.getElementById("studio-panel"), notice=document.getElementById("setup-notice");
 let client=null;
 const $=id=>document.getElementById(id);
 function say(el,text,error=false){el.textContent=text;el.classList.toggle("error",error);}
 function setup(){
   if(!cfg.supabaseUrl||!cfg.supabaseAnonKey||!window.supabase){notice.hidden=false;return false;}
   client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
   notice.hidden=true; return true;
 }
 $("login-form").addEventListener("submit",async e=>{e.preventDefault();if(!client)return say(msg,"Supabase connection is not configured.",true);say(msg,"Signing in…");const {error}=await client.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});if(error)return say(msg,error.message,true);say(msg,"Signed in.");await refresh();});
 $("logout").addEventListener("click",async()=>{await client.auth.signOut();await refresh();});
 $("upload-form").addEventListener("submit",async e=>{
   e.preventDefault();if(!client)return say(uploadMsg,"Supabase is not configured.",true);
   const {data:{user}}=await client.auth.getUser();if(!user)return say(uploadMsg,"Your session has expired. Please sign in again.",true);
   const file=$("audio-file").files[0];if(!file)return say(uploadMsg,"Choose an MP3 file.",true);
   if(!file.name.toLowerCase().endsWith(".mp3")&&file.type!=="audio/mpeg")return say(uploadMsg,"The file must be in MP3 format.",true);
   if(file.size>50*1024*1024)return say(uploadMsg,"File is too large (this interface has a 50 MB limit).",true);
   const progress=$("upload-progress");progress.hidden=false;progress.firstElementChild.style.width="15%";$("upload-form").querySelector('button[type="submit"]').disabled=true;
   try{
     const safeName=file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g,"-").replace(/-+/g,"-");
     const audioPath=user.id+"/"+Date.now()+"-"+safeName;
     const audioResult=await client.storage.from(cfg.audioBucket||"radio-audio").upload(audioPath,file,{contentType:"audio/mpeg",upsert:false,cacheControl:"3600"});
     if(audioResult.error)throw audioResult.error;
     progress.firstElementChild.style.width="65%";
     let coverPath=null;const coverFile=$("cover-file").files[0];
     if(coverFile){if(!/^image\/(jpeg|png|webp)$/.test(coverFile.type))throw new Error("Cover art must be a JPG, PNG, or WebP image.");if(coverFile.size>8*1024*1024)throw new Error("Cover art is too large (8 MB maximum).");const ext=coverFile.type==="image/png"?"png":coverFile.type==="image/webp"?"webp":"jpg";coverPath=user.id+"/"+Date.now()+"-cover."+ext;const cr=await client.storage.from(cfg.coversBucket||"radio-covers").upload(coverPath,coverFile,{contentType:coverFile.type,upsert:false});if(cr.error)throw cr.error;}
     progress.firstElementChild.style.width="85%";
     const payload={title:$("track-title").value.trim(),artist:$("track-artist").value.trim()||"Artemius",genre:$("track-genre").value.trim()||null,audio_path:audioPath,cover_path:coverPath,is_published:$("publish-now").checked,sort_order:Number($("track-order").value)||0,uploaded_by:user.id};
     const {error}=await client.from("radio_tracks").insert(payload);if(error){await client.storage.from(cfg.audioBucket||"radio-audio").remove([audioPath]);if(coverPath)await client.storage.from(cfg.coversBucket||"radio-covers").remove([coverPath]);throw error;}
     progress.firstElementChild.style.width="100%";say(uploadMsg,"Track uploaded successfully.");$("upload-form").reset();$("track-artist").value="Artemius";$("track-order").value="0";$("publish-now").checked=true;await loadTracks();
   }catch(err){console.error(err);say(uploadMsg,err.message||"Upload failed.",true);}finally{$("upload-form").querySelector('button[type="submit"]').disabled=false;setTimeout(()=>{progress.hidden=true;progress.firstElementChild.style.width="0"},1200);}
 });
 async function loadTracks(){
   const {data,error}=await client.from("radio_tracks").select("id,title,artist,genre,audio_path,cover_path,is_published,created_at").order("sort_order",{ascending:true}).order("created_at",{ascending:false});
   const container=$("admin-track-list");if(error){container.textContent="Unable to load tracks: "+error.message;return;}
   $("admin-track-count").textContent=(data||[]).length+" TRACK"+((data||[]).length>1?"S":"");container.innerHTML="";
   if(!data||!data.length){container.innerHTML='<p class="muted">No tracks uploaded yet.</p>';return;}
   data.forEach(t=>{const row=document.createElement("div");row.className="admin-track";const img=document.createElement("img");img.src=t.cover_path?client.storage.from(cfg.coversBucket||"radio-covers").getPublicUrl(t.cover_path).data.publicUrl:"assets/cover-placeholder.svg";img.alt="";const info=document.createElement("span");info.className="track-info";const strong=document.createElement("strong");strong.textContent=t.title;const sub=document.createElement("span");sub.textContent=(t.artist||"Artemius")+" · "+(t.is_published?"Published":"Draft");info.append(strong,sub);const btn=document.createElement("button");btn.type="button";btn.textContent="Delete";btn.addEventListener("click",()=>removeTrack(t));row.append(img,info,btn);container.append(row);});
 }
 async function removeTrack(t){if(!confirm("Delete “"+t.title+"” and its audio files? This action cannot be undone."))return;const btn=[...document.querySelectorAll(".admin-track button")].find(b=>b.parentElement.querySelector(".track-info strong")?.textContent===t.title);if(btn)btn.disabled=true;const {error}=await client.from("radio_tracks").delete().eq("id",t.id);if(error){say(uploadMsg,error.message,true);if(btn)btn.disabled=false;return;}await client.storage.from(cfg.audioBucket||"radio-audio").remove([t.audio_path]);if(t.cover_path)await client.storage.from(cfg.coversBucket||"radio-covers").remove([t.cover_path]);await loadTracks();}
 async function refresh(){const {data:{session}}=await client.auth.getSession();authPanel.hidden=!!session;studio.hidden=!session;if(session){say(msg,"");await loadTracks();}}
 if(setup()){client.auth.onAuthStateChange(()=>{refresh()});refresh();}
})();