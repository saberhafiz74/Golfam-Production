import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const $ = (id) => document.getElementById(id);
const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
let user = null, profile = null, authMode = "login", activePage = "overview";
let local = JSON.parse(localStorage.getItem("golfam-demo") || '{"reports":[],"devices":[],"products":[],"materials":[],"productions":[],"usages":[],"stops":[]}');
const saveLocal = () => localStorage.setItem("golfam-demo", JSON.stringify(local));
const toast = (msg) => { $("toast").textContent=msg; $("toast").classList.remove("hidden"); setTimeout(()=>$("toast").classList.add("hidden"),2800); };
const fa = (n) => new Intl.NumberFormat("fa-IR").format(n);
const todayJalali = () => new Intl.DateTimeFormat("fa-IR-u-ca-persian",{year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()).replaceAll("‏","");
const dateText = () => new Intl.DateTimeFormat("fa-IR-u-ca-persian",{weekday:"long",year:"numeric",month:"long",day:"numeric"}).format(new Date());
const esc = (s="") => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const demoId = () => crypto.randomUUID();
function show(id){["authView","appView"].forEach(x=>$(x).classList.add("hidden"));$(id).classList.remove("hidden");}
function setPage(page){activePage=page;document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));$("page-"+page)?.classList.remove("hidden");document.querySelectorAll(".nav-btn").forEach(x=>x.classList.toggle("active",x.dataset.page===page));}
function getReports(){return local.reports;}
function getDevices(){return local.devices;}
function getProducts(){return local.products;}
function getMaterials(){return local.materials;}
function setOptions(el,items,placeholder){el.innerHTML=`<option value="">${placeholder}</option>`+items.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("");}
function render(){
  $("todayText").textContent=dateText();
  $("welcomeTitle").textContent=profile?.display_name ? `سلام ${profile.display_name}` : "سلام، خوش آمدید";
  $("userAvatar").textContent=(profile?.display_name||user?.email||"گ").slice(0,1);
  const admin=profile?.role==="admin";
  $("adminNav").classList.toggle("hidden",!admin);$("operatorNav").classList.toggle("hidden",admin);
  $("logoutBtn").classList.remove("hidden");
  if(admin){
    $("statReports").textContent=fa(getReports().length);$("statDevices").textContent=fa(getDevices().length);
    $("statProduction").textContent=fa(local.productions.reduce((s,x)=>s+Number(x.qty||0)*Number(x.weight||0),0));
    $("recentReports").innerHTML=getReports().slice(-5).reverse().map(r=>`<div class="list-row"><div><b>${esc(r.date)}</b><small>شیفت ${esc(r.shift)}</small></div><span class="pill">${r.closed?"بسته":"باز"}</span></div>`).join("")||"هنوز گزارشی ثبت نشده است.";
    $("reportsList").innerHTML=getReports().slice().reverse().map(r=>`<div class="list-row"><div><b>${esc(r.date)} • ${esc(r.shift)}</b><small>${esc(r.note||"بدون توضیحات")}</small></div><button class="secondary" data-close="${r.id}">${r.closed?"بازگشایی":"بستن گزارش"}</button></div>`).join("")||"گزارشی وجود ندارد.";
    $("devicesList").innerHTML=getDevices().map(d=>`<div class="list-row"><div><b>${esc(d.name)}</b><small>${esc(d.operator||"بدون اپراتور")}</small></div><span class="pill">فعال</span></div>`).join("")||"دستگاهی تعریف نشده است.";
    $("productsList").innerHTML=getProducts().map(p=>`<div class="list-row"><div><b>${esc(p.name)}</b><small>${esc(p.unit)} • ${fa(p.weight)} کیلوگرم</small></div></div>`).join("")||"محصولی ثبت نشده است.";
    $("materialsList").innerHTML=getMaterials().map(m=>`<div class="list-row"><div><b>${esc(m.name)}</b><small>واحد: ${esc(m.unit)}</small></div></div>`).join("")||"ماده‌ای ثبت نشده است.";
    $("deviceOperator").innerHTML='<option value="">بدون اپراتور</option>';
    $("usersList").innerHTML=configured?"برای مدیریت نقش کاربران از پنل Supabase و دستورالعمل راه‌اندازی استفاده کنید.":"در حالت آزمایشی، مدیریت کاربران واقعی فعال نیست.";
  } else {
    const device=getDevices().find(d=>d.operatorId===user?.id)||getDevices()[0];
    $("assignedDevice").textContent=device?.name||"هنوز دستگاهی به حساب شما اختصاص داده نشده است.";
    const report=getReports().find(r=>!r.closed);
    $("activeReportLabel").textContent=report?`گزارش فعال: ${report.date} • شیفت ${report.shift}`:"گزارش فعال: —";
    $("operatorNoReport").classList.toggle("hidden",!!report);
    $("operatorForms").classList.toggle("hidden",!report||!device);
    setOptions($("productionProduct"),getProducts(),"انتخاب محصول");
    setOptions($("usageMaterial"),getMaterials(),"انتخاب ماده اولیه");
    $("operatorEntries").innerHTML=[...local.productions.map(x=>`<div class="list-row"><div><b>تولید ${esc(x.product)}</b><small>${fa(x.qty)} ${esc(x.unit)} • بچ ${esc(x.batch)}</small></div><span class="pill">${fa(x.qty*x.weight)} کیلوگرم</span></div>`),...local.usages.map(x=>`<div class="list-row"><div><b>مصرف ${esc(x.material)}</b><small>${fa(x.qty)} ${esc(x.unit)}</small></div></div>`),...local.stops.map(x=>`<div class="list-row"><div><b>توقف دستگاه</b><small>${esc(x.reason)}</small></div><span class="pill">${esc(x.duration)}</span></div>`)].join("")||"هنوز اطلاعاتی ثبت نشده است.";
  }
}
function setupApp(){
  $("connection").textContent=configured?"اتصال ابری":"حالت آزمایشی";
  $("connection").className="status "+(configured?"online":"offline");
  $("setupNotice").classList.toggle("hidden",configured);
  $("reportDate").value=todayJalali();
  document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>setPage(b.dataset.page)));
  document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>setPage(b.dataset.goto)));
  document.querySelectorAll("[data-auth]").forEach(b=>b.addEventListener("click",()=>{authMode=b.dataset.auth;document.querySelectorAll("[data-auth]").forEach(x=>x.classList.toggle("active",x===b));$("authSubmit").textContent=authMode==="login"?"ورود":"ساخت حساب";$("authHint").textContent=authMode==="login"?"حساب کاربری را مدیر سامانه برای شما ایجاد می‌کند.":"ثبت‌نام فقط حساب اپراتور می‌سازد؛ مدیر باید دسترسی دستگاه را اختصاص دهد.";}));
  $("authForm").addEventListener("submit",async e=>{e.preventDefault();if(!configured){toast("برای ورود چندکاربره ابتدا Supabase را تنظیم کنید.");return;}const email=$("email").value,password=$("password").value;const result=authMode==="login"?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password});if(result.error)return toast(result.error.message);toast(authMode==="login"?"ورود موفق":"حساب ساخته شد؛ در صورت نیاز ایمیل را تأیید کنید.");});
  $("logoutBtn").addEventListener("click",async()=>{if(configured)await supabase.auth.signOut();user=null;profile=null;show("authView");});
  $("reportForm").addEventListener("submit",e=>{e.preventDefault();local.reports.push({id:demoId(),date:$("reportDate").value,shift:$("reportShift").value,note:$("reportNote").value,closed:false});saveLocal();render();toast("گزارش روزانه ایجاد شد.");});
  $("deviceForm").addEventListener("submit",e=>{e.preventDefault();local.devices.push({id:demoId(),name:$("deviceName").value,operator:$("deviceOperator").selectedOptions[0]?.text||"",operatorId:$("deviceOperator").value});saveLocal();e.target.reset();render();toast("دستگاه اضافه شد.");});
  $("productForm").addEventListener("submit",e=>{e.preventDefault();local.products.push({id:demoId(),name:$("productName").value,unit:$("productUnit").value,weight:Number($("productWeight").value)});saveLocal();e.target.reset();render();toast("محصول اضافه شد.");});
  $("materialForm").addEventListener("submit",e=>{e.preventDefault();local.materials.push({id:demoId(),name:$("materialName").value,unit:$("materialUnit").value});saveLocal();e.target.reset();render();toast("ماده اولیه اضافه شد.");});
  $("productionProduct").addEventListener("change",()=>{const p=getProducts().find(x=>x.id===$("productionProduct").value);if(p){$("productionUnit").value=p.unit;$("productionWeight").value=p.weight;}});
  const calc=()=>{$("totalWeight").textContent=fa(Number($("productionQty").value||0)*Number($("productionWeight").value||0))+" کیلوگرم";};
  ["productionQty","productionWeight"].forEach(id=>$(id).addEventListener("input",calc));
  $("usageMaterial").addEventListener("change",()=>{const m=getMaterials().find(x=>x.id===$("usageMaterial").value);if(m)$("usageUnit").value=m.unit;});
  $("stopStart").addEventListener("input",calcStop);$("stopEnd").addEventListener("input",calcStop);
  $("productionForm").addEventListener("submit",e=>{e.preventDefault();const p=getProducts().find(x=>x.id===$("productionProduct").value);if(!p)return toast("ابتدا محصول را انتخاب کنید.");local.productions.push({product:p.name,qty:Number($("productionQty").value),unit:$("productionUnit").value,weight:Number($("productionWeight").value),batch:$("batchNumber").value});saveLocal();e.target.reset();calc();render();toast("تولید ثبت شد.");});
  $("usageForm").addEventListener("submit",e=>{e.preventDefault();const m=getMaterials().find(x=>x.id===$("usageMaterial").value);if(!m)return toast("ماده اولیه را انتخاب کنید.");local.usages.push({material:m.name,qty:Number($("usageQty").value),unit:$("usageUnit").value,batch:$("usageBatch").value});saveLocal();e.target.reset();render();toast("مصرف مواد ثبت شد.");});
  $("downtimeForm").addEventListener("submit",e=>{e.preventDefault();const a=$("stopStart").value,b=$("stopEnd").value;if(!a||!b)return;let [ah,am]=a.split(":").map(Number),[bh,bm]=b.split(":").map(Number);let mins=bh*60+bm-(ah*60+am);if(mins<=0)mins+=1440;if(mins>1440)return toast("مدت توقف نامعتبر است.");const duration=`${Math.floor(mins/60)} ساعت و ${mins%60} دقیقه`;local.stops.push({reason:$("stopReason").value,duration,start:a,end:b});saveLocal();e.target.reset();$("stopDuration").textContent="—";render();toast("توقف ثبت شد.");});
  document.addEventListener("click",e=>{const id=e.target.dataset.close;if(id){const r=local.reports.find(x=>x.id===id);r.closed=!r.closed;saveLocal();render();}});
}
function calcStop(){const a=$("stopStart").value,b=$("stopEnd").value;if(!a||!b){$("stopDuration").textContent="—";return;}let [ah,am]=a.split(":").map(Number),[bh,bm]=b.split(":").map(Number),m=bh*60+bm-(ah*60+am);if(m<=0)m+=1440;$("stopDuration").textContent=`${fa(Math.floor(m/60))} ساعت و ${fa(m%60)} دقیقه`;}
async function loadProfile(session){
  user=session?.user||null;if(!user){show("authView");return;}
  if(!configured)return;
  const {data,error}=await supabase.from("profiles").select("*").eq("id",user.id).single();
  if(error){toast("پروفایل کاربر هنوز آماده نیست.");profile={role:"operator",display_name:user.email};}else profile=data;
  // نسخه نمایشی محلی نیست؛ داده‌های ابری در نسخه اتصال کامل از جداول خوانده می‌شوند.
  show("appView");render();
}
setupApp();
if(configured){
  supabase.auth.onAuthStateChange((_event,session)=>loadProfile(session));
  const {data}=await supabase.auth.getSession();await loadProfile(data.session);
}else{
  $("authView").classList.add("hidden");$("appView").classList.remove("hidden");
  profile={role:"admin",display_name:"مدیر آزمایشی"};user={id:"demo"};render();
}
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
