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
 $("login-form").addEventListener("submit",async e=>{e.preventDefault();if(!client)return say(msg,"La connexion Supabase n’est pas configurée.",true);say(msg,"Connexion…");const {error}=await client.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});if(error)return say(msg,error.message,true);say(msg,"Connecté.");await refresh();});
 $("logout").addEventListener("click",async()=>{await client.auth.signOut();await refresh();});
 $("upload-form").addEventListener("submit",async e=>{
   e.preventDefault();if(!client)return say(uploadMsg,"Supabase n’est pas configuré.",true);
   const {data:{user}}=await client.auth.getUser();if(!user)return say(uploadMsg,"Session expirée. Reconnecte-toi.",true);
   const file=$("audio-file").files[0];if(!file)return say(uploadMsg,"Choisis un fichier MP3.",true);
   if(!file.name.toLowerCase().endsWith(".mp3")&&file.type!=="audio/mpeg")return say(uploadMsg,"Le fichier doit être au format MP3.",true);
   if(file.size>50*1024*1024)return say(uploadMsg,"Fichier trop volumineux (limite de cette interface : 50 Mo).",true);
   const progress=$("upload-progress");progress.hidden=false;progress.firstElementChild.style.width="15%";$("upload-form").querySelector('button[type="submit"]').disabled=true;
   try{
     const safeName=file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g,"-").replace(/-+/g,"-");
     const audioPath=user.id+"/"+Date.now()+"-"+safeName;
     const audioResult=await client.storage.from(cfg.audioBucket||"radio-audio").upload(audioPath,file,{contentType:"audio/mpeg",upsert:false,cacheControl:"3600"});
     if(audioResult.error)throw audioResult.error;
     progress.firstElementChild.style.width="65%";
     let coverPath=null;const coverFile=$("cover-file").files[0];
     if(coverFile){if(!/^image\/(jpeg|png|webp)$/.test(coverFile.type))throw new Error("La pochette doit être une image JPG, PNG ou WebP.");if(coverFile.size>8*1024*1024)throw new Error("Pochette trop volumineuse (maximum 8 Mo).");const ext=coverFile.type==="image/png"?"png":coverFile.type==="image/webp"?"webp":"jpg";coverPath=user.id+"/"+Date.now()+"-cover."+ext;const cr=await client.storage.from(cfg.coversBucket||"radio-covers").upload(coverPath,coverFile,{contentType:coverFile.type,upsert:false});if(cr.error)throw cr.error;}
     progress.firstElementChild.style.width="85%";
     const payload={title:$("track-title").value.trim(),artist:$("track-artist").value.trim()||"Artemius",genre:$("track-genre").value.trim()||null,audio_path:audioPath,cover_path:coverPath,is_published:$("publish-now").checked,sort_order:Number($("track-order").value)||0,uploaded_by:user.id};
     const {error}=await client.from("radio_tracks").insert(payload);if(error){await client.storage.from(cfg.audioBucket||"radio-audio").remove([audioPath]);if(coverPath)await client.storage.from(cfg.coversBucket||"radio-covers").remove([coverPath]);throw error;}
     progress.firstElementChild.style.width="100%";say(uploadMsg,"Morceau importé avec succès.");$("upload-form").reset();$("track-artist").value="Artemius";$("track-order").value="0";$("publish-now").checked=true;await loadTracks();
   }catch(err){console.error(err);say(uploadMsg,err.message||"Erreur lors de l’import.",true);}finally{$("upload-form").querySelector('button[type="submit"]').disabled=false;setTimeout(()=>{progress.hidden=true;progress.firstElementChild.style.width="0"},1200);}
 });
 async function loadTracks(){
   const {data,error}=await client.from("radio_tracks").select("id,title,artist,genre,audio_path,cover_path,is_published,created_at").order("sort_order",{ascending:true}).order("created_at",{ascending:false});
   const container=$("admin-track-list");if(error){container.textContent="Impossible de charger les morceaux : "+error.message;return;}
   $("admin-track-count").textContent=(data||[]).length+" TITRE"+((data||[]).length>1?"S":"");container.innerHTML="";
   if(!data||!data.length){container.innerHTML='<p class="muted">Aucun morceau importé pour le moment.</p>';return;}
   data.forEach(t=>{const row=document.createElement("div");row.className="admin-track";const img=document.createElement("img");img.src=t.cover_path?client.storage.from(cfg.coversBucket||"radio-covers").getPublicUrl(t.cover_path).data.publicUrl:"assets/cover-placeholder.svg";img.alt="";const info=document.createElement("span");info.className="track-info";const strong=document.createElement("strong");strong.textContent=t.title;const sub=document.createElement("span");sub.textContent=(t.artist||"Artemius")+" · "+(t.is_published?"Publié":"Brouillon");info.append(strong,sub);const btn=document.createElement("button");btn.type="button";btn.textContent="Supprimer";btn.addEventListener("click",()=>removeTrack(t));row.append(img,info,btn);container.append(row);});
 }
 async function removeTrack(t){if(!confirm("Supprimer « "+t.title+" » et ses fichiers audio ? Cette action est définitive."))return;const btn=[...document.querySelectorAll(".admin-track button")].find(b=>b.parentElement.querySelector(".track-info strong")?.textContent===t.title);if(btn)btn.disabled=true;const {error}=await client.from("radio_tracks").delete().eq("id",t.id);if(error){say(uploadMsg,error.message,true);if(btn)btn.disabled=false;return;}await client.storage.from(cfg.audioBucket||"radio-audio").remove([t.audio_path]);if(t.cover_path)await client.storage.from(cfg.coversBucket||"radio-covers").remove([t.cover_path]);await loadTracks();}
 async function refresh(){const {data:{session}}=await client.auth.getSession();authPanel.hidden=!!session;studio.hidden=!session;if(session){say(msg,"");await loadTracks();}}
 if(setup()){client.auth.onAuthStateChange(()=>{refresh()});refresh();}
})();