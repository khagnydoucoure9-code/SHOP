import { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_BUCKET } from "./config.js";
const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const sizes = ["S","M","L","XL","XXL"];
let products=[], categories=[];

const $=s=>document.querySelector(s);
const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const toast=(msg)=>{const t=$("#toast");t.textContent=msg;t.style.display="block";setTimeout(()=>t.style.display="none",2200)};
const isAdmin=async()=>{const {data:{user}}=await db.auth.getUser();if(!user)return false;const {data,error}=await db.from("admin_users").select("user_id").eq("user_id",user.id).maybeSingle();return !error&&!!data};
async function start(){
  const {data:{session}}=await db.auth.getSession();
  if(session && await isAdmin()) showAdmin(session.user); else showLogin();
}
function showLogin(){ $("#loginView").hidden=false; $("#adminView").hidden=true; }
function showAdmin(user){ $("#loginView").hidden=true; $("#adminView").hidden=false; $("#adminEmail").textContent=user.email||""; loadAll(); }
async function loadAll(){
  const [c,p]=await Promise.all([
    db.from("categories").select("*").order("sort_order"),
    db.from("products").select("*, categories(name), product_sizes(*)").order("created_at",{ascending:false})
  ]);
  if(c.error||p.error){toast("Erreur de chargement");console.error(c.error||p.error);return}
  categories=c.data||[];products=p.data||[];render();
}
function totalStock(p){return (p.product_sizes||[]).filter(s=>s.enabled).reduce((n,s)=>n+Number(s.quantity||0),0)}
function render(){
  $("#statProducts").textContent=products.filter(p=>p.active).length;
  $("#statStock").textContent=products.reduce((n,p)=>n+totalStock(p),0);
  $("#statOut").textContent=products.filter(p=>totalStock(p)===0).length;
  $("#statNew").textContent=products.filter(p=>p.is_new).length;
  $("#statFeatured").textContent=products.filter(p=>p.is_featured).length;
  $("#adminCategory").innerHTML='<option value="">Toutes les catégories</option>'+categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
  $("#pCategory").innerHTML=categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
  const q=$("#adminSearch").value.toLowerCase(), cat=$("#adminCategory").value, stock=$("#adminStock").value;
  const list=products.filter(p=>(!q||[p.name,p.description,p.categories?.name].join(" ").toLowerCase().includes(q))&&(!cat||p.category_id===cat)&&(!stock||(stock==="in"?totalStock(p)>0:totalStock(p)===0)));
  $("#adminProducts").innerHTML=list.map(p=>`<tr>
    <td><strong>${esc(p.name)}</strong></td><td>${Number(p.price).toLocaleString("fr-FR")} 🎾</td><td>${esc(p.categories?.name||"—")}</td>
    <td><div class="stock-mini">${(p.product_sizes||[]).filter(s=>s.enabled).map(s=>`<span>${s.size}: ${s.quantity}</span>`).join("")||"—"}</div></td>
    <td>${p.active?"Actif":"Masqué"}${p.is_new?" · Nouveau":""}${p.is_featured?" · ⭐":""}</td>
    <td><button class="admin-btn" data-edit="${p.id}">Modifier</button> <button class="admin-btn danger" data-del="${p.id}">Supprimer</button></td>
  </tr>`).join("");
  $("#categoryAdminList").innerHTML=categories.map(c=>`<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee"><span>${esc(c.name)}</span><button class="admin-btn" data-cat-edit="${c.id}">Modifier</button></div>`).join("");
  document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openProduct(b.dataset.edit));
  document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>deleteProduct(b.dataset.del));
  document.querySelectorAll("[data-cat-edit]").forEach(b=>b.onclick=()=>openCategory(b.dataset.catEdit));
}
function resetForm(){
  $("#productId").value="";$("#modalTitle").textContent="Ajouter un produit";$("#pName").value="";$("#pPrice").value="";
  $("#pDescription").value="";$("#pImage").value="";$("#pActive").checked=true;$("#pNew").checked=false;$("#pFeatured").checked=false;
  $("#sizeInputs").innerHTML=sizes.map(s=>`<label style="font-size:.7rem"><span><input type="checkbox" data-enabled="${s}"> ${s}</span><input type="number" min="0" value="0" data-qty="${s}"></label>`).join("");
}
function openProduct(id=null){
  resetForm();
  if(id){
    const p=products.find(x=>x.id===id); if(!p)return;
    $("#modalTitle").textContent="Modifier le produit";$("#productId").value=p.id;$("#pName").value=p.name;$("#pPrice").value=p.price;$("#pDescription").value=p.description||"";
    $("#pCategory").value=p.category_id;$("#pActive").checked=p.active;$("#pNew").checked=p.is_new;$("#pFeatured").checked=p.is_featured;
    for(const s of (p.product_sizes||[])){const en=$(`[data-enabled="${s.size}"]`),q=$(`[data-qty="${s.size}"]`);if(en){en.checked=s.enabled;q.value=s.quantity}}
  }
  $("#productModal").showModal();
}
async function uploadImage(file,id){
  if(!file)return null;
  const ext=file.name.split(".").pop().toLowerCase();if(!["jpg","jpeg","png","webp"].includes(ext))throw new Error("Format image non accepté");
  const path=`${id}/${crypto.randomUUID()}.${ext}`;
  const {error}=await db.storage.from(STORAGE_BUCKET).upload(path,file,{upsert:false,contentType:file.type});
  if(error)throw error; return path;
}
$("#productForm").addEventListener("submit",async e=>{
  e.preventDefault();
  try{
    const id=$("#productId").value||crypto.randomUUID();
    const payload={id,name:$("#pName").value.trim(),price:Number($("#pPrice").value),description:$("#pDescription").value.trim(),category_id:$("#pCategory").value||null,active:$("#pActive").checked,is_new:$("#pNew").checked,is_featured:$("#pFeatured").checked};
    const file=$("#pImage").files[0];if(file)payload.image_path=await uploadImage(file,id);
    let error;
    if($("#productId").value){({error}=await db.from("products").update(payload).eq("id",id))}
    else {({error}=await db.from("products").insert(payload))}
    if(error)throw error;
    const rows=sizes.map(s=>({product_id:id,size:s,enabled:$(`[data-enabled="${s}"]`).checked,quantity:Math.max(0,Number($(`[data-qty="${s}"]`).value||0))}));
    ({error}=await db.from("product_sizes").upsert(rows,{onConflict:"product_id,size"}));if(error)throw error;
    toast("Produit enregistré");$("#productModal").close();await loadAll();
  }catch(err){console.error(err);toast(err.message||"Erreur")}
});
async function deleteProduct(id){
  if(!confirm("Supprimer définitivement ce produit ?"))return;
  const {error}=await db.from("products").delete().eq("id",id);if(error){toast(error.message);return}toast("Produit supprimé");loadAll();
}
$("#addProduct").onclick=()=>openProduct();
$("#cancelModal").onclick=()=>$("#productModal").close();
$("#adminSearch").oninput=render;$("#adminCategory").onchange=render;$("#adminStock").onchange=render;
$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();$("#loginError").textContent="";const {data,error}=await db.auth.signInWithPassword({email:$("#email").value,password:$("#password").value});if(error){$("#loginError").textContent=error.message;return}if(!(await isAdmin())){await db.auth.signOut();$("#loginError").textContent="Ce compte n'est pas autorisé à accéder à l'administration.";return}showAdmin(data.user)});
$("#logout").onclick=async()=>{await db.auth.signOut();showLogin()};
$("#createCategory").onclick=async()=>{const name=$("#newCategory").value.trim();if(!name)return;const {error}=await db.from("categories").insert({name,sort_order:categories.length});if(error)toast(error.message);else{$("#newCategory").value="";toast("Catégorie ajoutée");loadAll()}};
function openCategory(id){const c=categories.find(x=>x.id===id);if(!c)return;$("#categoryId").value=c.id;$("#categoryName").value=c.name;$("#categoryModal").showModal()}
$("#cancelCategory").onclick=()=>$("#categoryModal").close();
$("#categoryForm").addEventListener("submit",async e=>{e.preventDefault();const {error}=await db.from("categories").update({name:$("#categoryName").value.trim()}).eq("id",$("#categoryId").value);if(error)toast(error.message);else{$("#categoryModal").close();toast("Catégorie modifiée");loadAll()}});
db.channel("admin-live").on("postgres_changes",{event:"*",schema:"public",table:"products"},loadAll).on("postgres_changes",{event:"*",schema:"public",table:"product_sizes"},loadAll).on("postgres_changes",{event:"*",schema:"public",table:"categories"},loadAll).subscribe();
start();
