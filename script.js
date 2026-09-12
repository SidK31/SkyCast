const cityInput = document.querySelector("#cityInput");
const searchBtn = document.querySelector("#searchBtn");
const locationBtn = document.querySelector("#locationBtn");
const unitToggle = document.querySelector("#unitToggle");
const themeToggle = document.querySelector("#themeToggle");
const result = document.querySelector("#result");
const status = document.querySelector("#status");
const app = document.querySelector("#app");

let currentWeather = null;
let isCelsius = localStorage.getItem("skycast-unit") !== "F";
let isDark = localStorage.getItem("skycast-theme") !== "light";
let recentCities = safeJSON("skycast-recent", []);
let favoriteCities = safeJSON("skycast-favorites", []);

const weatherCodes = {
  0:["Clear sky","☀️","clear"],1:["Mainly clear","🌤️","clear"],2:["Partly cloudy","⛅","cloud"],3:["Overcast","☁️","cloud"],
  45:["Fog","🌫️","fog"],48:["Rime fog","🌫️","fog"],51:["Light drizzle","🌦️","rain"],53:["Drizzle","🌦️","rain"],55:["Heavy drizzle","🌧️","rain"],
  61:["Light rain","🌦️","rain"],63:["Rain","🌧️","rain"],65:["Heavy rain","🌧️","rain"],71:["Light snow","🌨️","snow"],73:["Snow","❄️","snow"],75:["Heavy snow","❄️","snow"],
  80:["Rain showers","🌦️","rain"],81:["Rain showers","🌧️","rain"],82:["Heavy showers","⛈️","rain"],95:["Thunderstorm","⛈️","storm"],96:["Thunderstorm + hail","⛈️","storm"],99:["Thunderstorm + hail","⛈️","storm"]
};

function safeJSON(key, fallback){ try { const value=JSON.parse(localStorage.getItem(key)||"null"); return Array.isArray(value)?value:fallback; } catch { return fallback; } }
function setStatus(message=""){ status.textContent=message; }
function weatherInfo(code){ return weatherCodes[code] || ["Unknown conditions","🌡️","unknown"]; }
function toFahrenheit(c){ return Math.round((c*9)/5+32); }
function temperature(value){ if(value==null || Number.isNaN(Number(value))) return "—"; return `${isCelsius?Math.round(value):toFahrenheit(value)}°`; }
function speed(value){ return value==null?"—":`${Math.round(value)} km/h`; }
function formatTime(iso){ if(!iso) return "—"; const [h,m]=String(iso).slice(11,16).split(":").map(Number); if(Number.isNaN(h)) return "—"; const suffix=h>=12?"PM":"AM"; const hour=h%12||12; return `${hour}:${String(m).padStart(2,"0")} ${suffix}`; }
function formatDay(date){ return new Intl.DateTimeFormat([], {weekday:"short"}).format(new Date(`${date}T12:00:00`)); }
function formatDate(date){ return new Intl.DateTimeFormat([], {month:"short",day:"numeric"}).format(new Date(`${date}T12:00:00`)); }
function escapeHTML(value){ return String(value).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c])); }
function hourMinutes(iso){ const match=String(iso||"").match(/T(\d{2}):(\d{2})/); return match?Number(match[1])*60+Number(match[2]):0; }
function clamp(value,min,max){ return Math.min(max,Math.max(min,value)); }

function setBackground(code,isDay=true){
  const type=weatherInfo(code)[2];
  app.dataset.weather=type;
  app.dataset.day=isDay?"day":"night";
  document.body.dataset.weather=type;
  document.body.dataset.day=isDay?"day":"night";
}

function applyTheme(){
  document.body.dataset.theme=isDark?"dark":"light";
  themeToggle.textContent=isDark?"☾":"☀";
  themeToggle.title=isDark?"Switch to light theme":"Switch to dark theme";
  themeToggle.setAttribute("aria-label",themeToggle.title);
}

function saveCity(name){
  recentCities=[name,...recentCities.filter(city=>city.toLowerCase()!==name.toLowerCase())].slice(0,6);
  localStorage.setItem("skycast-recent",JSON.stringify(recentCities));
  renderQuickCities();
}
function isFavorite(name){ return favoriteCities.some(city=>city.toLowerCase()===name.toLowerCase()); }
function toggleFavorite(name){
  if(isFavorite(name)) favoriteCities=favoriteCities.filter(city=>city.toLowerCase()!==name.toLowerCase());
  else favoriteCities=[name,...favoriteCities.filter(city=>city.toLowerCase()!==name.toLowerCase())].slice(0,8);
  localStorage.setItem("skycast-favorites",JSON.stringify(favoriteCities));
  renderQuickCities();
  if(currentWeather) renderWeather(currentWeather.place,currentWeather.data);
}
function renderQuickCities(){
  const box=document.querySelector("#quickCities"); if(!box)return;
  const favorites=favoriteCities.map(city=>`<button class="saved-city favorite-city" data-city="${escapeHTML(city)}">★ ${escapeHTML(city)}</button>`).join("");
  const recent=recentCities.filter(city=>!isFavorite(city)).map(city=>`<button class="saved-city" data-city="${escapeHTML(city)}">↗ ${escapeHTML(city)}</button>`).join("");
  if(!favorites&&!recent){ box.innerHTML=""; return; }
  box.innerHTML=`<div class="section-heading"><h3>Quick access</h3><span>${favorites?"Favorites":"Recent searches"}</span></div><div class="saved-cities">${favorites}${recent}${recentCities.length?'<button class="clear-cities" id="clearCities">Clear recent</button>':""}</div>`;
  box.querySelectorAll(".saved-city").forEach(btn=>btn.addEventListener("click",()=>searchWeather(btn.dataset.city)));
  box.querySelector("#clearCities")?.addEventListener("click",()=>{recentCities=[];localStorage.removeItem("skycast-recent");renderQuickCities();});
}

async function geocodeCity(city){
  const url=`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=en&format=json`;
  const response=await fetch(url); if(!response.ok)throw new Error("Unable to search for that city.");
  const data=await response.json(); if(!data.results?.length)throw new Error("City not found. Try a city and country name.");
  return data.results[0];
}

async function getWeather(latitude,longitude){
  const params=new URLSearchParams({
    latitude,longitude,
    current:"temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,pressure_msl,visibility,uv_index",
    hourly:"temperature_2m,precipitation_probability,weather_code,uv_index,relative_humidity_2m,wind_speed_10m",
    daily:"weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,uv_index_max",
    timezone:"auto",forecast_days:"7",forecast_hours:"24"
  });
  const response=await fetch(`https://api.open-meteo.com/v1/forecast?${params}`); if(!response.ok)throw new Error("Weather data is temporarily unavailable.");
  return response.json();
}

function getHourly(data){
  const times=data.hourly?.time||[]; let start=times.findIndex(t=>t>=data.current.time); if(start<0)start=0;
  return times.slice(start,start+12).map((time,i)=>{const n=start+i;return {time,temp:data.hourly.temperature_2m[n],code:data.hourly.weather_code[n],rain:data.hourly.precipitation_probability?.[n]??0,uv:data.hourly.uv_index?.[n]??0,humidity:data.hourly.relative_humidity_2m?.[n]??0,wind:data.hourly.wind_speed_10m?.[n]??0};});
}
function getDays(data){ return (data.daily?.time||[]).map((date,i)=>({date,code:data.daily.weather_code[i],max:data.daily.temperature_2m_max[i],min:data.daily.temperature_2m_min[i],rain:data.daily.precipitation_probability_max?.[i]??0,sunrise:data.daily.sunrise?.[i],sunset:data.daily.sunset?.[i],uv:data.daily.uv_index_max?.[i]??0})); }

function sunProgress(currentTime,sunrise,sunset){
  const now=hourMinutes(currentTime), rise=hourMinutes(sunrise), set=hourMinutes(sunset); if(set<=rise)return 0;
  return clamp(((now-rise)/(set-rise))*100,0,100);
}
function uvLabel(uv){ return uv<=2?"Low":uv<=5?"Moderate":uv<=7?"High":uv<=10?"Very high":"Extreme"; }
function rainLabel(chance){ return chance>=70?"High":chance>=40?"Medium":"Low"; }
function comfortLabel(temp,humidity){ if(temp>=35)return ["Low","Very hot"]; if(temp<=12)return ["Low","Chilly"]; if(temp>=30&&humidity>=70)return ["Fair","Warm & humid"]; return ["Good","Comfortable"]; }
function makeStory(current,day){
  const [condition]=weatherInfo(current.weather_code); const rain=day.rain||0;
  if([95,96,99].includes(current.weather_code))return ["Storm watch","Thunderstorms are possible. Keep outdoor plans flexible and check local alerts."];
  if(rain>=70)return ["Umbrella recommended",`${rain}% is the peak rain chance today. A high near ${temperature(day.max)} is expected.`];
  if(rain>=40)return ["Clouds may build",`There is a moderate rain chance today, with temperatures from ${temperature(day.min)} to ${temperature(day.max)}.`];
  if(day.max>=35)return ["Hot day ahead",`Temperatures may reach ${temperature(day.max)}. Stay hydrated and take breaks from direct midday sun.`];
  if(day.max<=12)return ["Chilly day ahead",`Temperatures stay cool, from ${temperature(day.min)} to ${temperature(day.max)}. A warm layer may help.`];
  return [`${condition} today`,`A ${temperature(day.max)} high and ${temperature(day.min)} low are expected, with a ${rain}% peak rain chance.`];
}

function drawTemperatureChart(hourly){
  const canvas=document.querySelector("#temperatureChart"); if(!canvas||!hourly.length)return;
  const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1,width=Math.max(300,rect.width),height=230;
  canvas.width=width*dpr;canvas.height=height*dpr;const ctx=canvas.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);
  const values=hourly.map(x=>isCelsius?x.temp:toFahrenheit(x.temp)),min=Math.floor(Math.min(...values)-2),max=Math.ceil(Math.max(...values)+2);
  const pad={top:30,right:18,bottom:34,left:42},plotW=width-pad.left-pad.right,plotH=height-pad.top-pad.bottom,x=i=>pad.left+(i/Math.max(values.length-1,1))*plotW,y=v=>pad.top+((max-v)/Math.max(max-min,1))*plotH;
  const css=getComputedStyle(document.body),text=css.getPropertyValue("--text").trim(),muted=css.getPropertyValue("--muted").trim(),line=css.getPropertyValue("--line").trim(),accent=css.getPropertyValue("--accent").trim();
  ctx.font="11px DM Sans,sans-serif";ctx.strokeStyle=line;ctx.lineWidth=1;
  for(let i=0;i<3;i++){const v=min+((max-min)/2)*i,yy=y(v);ctx.beginPath();ctx.moveTo(pad.left,yy);ctx.lineTo(width-pad.right,yy);ctx.stroke();ctx.fillStyle=muted;ctx.fillText(`${Math.round(v)}°`,8,yy+4);}
  const gradient=ctx.createLinearGradient(0,pad.top,0,height);gradient.addColorStop(0,accent.replace(" )"," )"));gradient.addColorStop(1,"transparent");
  ctx.beginPath();values.forEach((v,i)=>i?ctx.lineTo(x(i),y(v)):ctx.moveTo(x(i),y(v)));ctx.strokeStyle=accent;ctx.lineWidth=3;ctx.lineJoin="round";ctx.lineCap="round";ctx.stroke();
  values.forEach((v,i)=>{ctx.beginPath();ctx.arc(x(i),y(v),i===0?5:3,0,Math.PI*2);ctx.fillStyle=accent;ctx.fill();if(i%3===0||i===values.length-1){ctx.fillStyle=text;ctx.textAlign="center";ctx.fillText(`${Math.round(v)}°`,x(i),y(v)-11);ctx.fillStyle=muted;ctx.fillText(i===0?"Now":formatTime(hourly[i].time),x(i),height-10);}});ctx.textAlign="start";
}

function renderWeather(place,data){
  currentWeather={place,data};const current=data.current,info=weatherInfo(current.weather_code),days=getDays(data),today=days[0],hourly=getHourly(data);
  setBackground(current.weather_code,Boolean(current.is_day));cityInput.value=place.name==="Your location"?"":place.name;
  const favorite=place.name!=="Your location"&&isFavorite(place.name),comfort=comfortLabel(current.temperature_2m,current.relative_humidity_2m),story=makeStory(current,today),progress=sunProgress(current.time,today.sunrise,today.sunset),uv=current.uv_index??today.uv??0;
  const cityName=escapeHTML(place.name),region=place.admin1?`, ${escapeHTML(place.admin1)}`:"",country=place.country_code?escapeHTML(place.country_code):"";
  const hourCards=hourly.map((item,index)=>{const wi=weatherInfo(item.code),height=clamp(item.rain,4,100);return `<article class="forecast-item ${index===0?"now": ""}"><span>${index===0?"NOW":formatTime(item.time)}</span><b>${wi[1]}</b><strong>${temperature(item.temp)}</strong><small>${item.rain}% rain</small><i class="rain-bar"><em style="height:${height}%"></em></i></article>`;}).join("");
  const dayRows=days.map((day,index)=>{const wi=weatherInfo(day.code);return `<div class="day-row"><strong>${index===0?"Today":formatDay(day.date)}</strong><span class="day-condition"><b>${wi[1]}</b> ${wi[0]}</span><span class="rain-pill">💧 ${day.rain}%</span><strong>${temperature(day.max)} <em>${temperature(day.min)}</em></strong></div>`;}).join("");
  result.innerHTML=`
  <section class="current-card glass section-block">
    <div class="current-main"><div><p class="eyebrow">CURRENT WEATHER</p><div class="title-row"><h2>${cityName}${region}</h2><button id="favoriteBtn" class="round-action ${favorite?"active":""}" title="${favorite?"Remove from favorites":"Add to favorites"}" aria-label="${favorite?"Remove from favorites":"Add to favorites"}">${favorite?"★":"☆"}</button></div><p class="location-sub">${country||"Local forecast"} · ${current.is_day?"Daytime":"Nighttime"}</p><p class="condition">${info[0]}</p><div class="temperature">${temperature(current.temperature_2m)}<span>${isCelsius?"C":"F"}</span></div><p class="feels">Feels like ${temperature(current.apparent_temperature)}</p></div><div class="weather-icon" aria-label="${info[0]}">${info[1]}</div></div>
    <div class="metrics"><div><span>💧 Humidity</span><strong>${current.relative_humidity_2m}%</strong></div><div><span>💨 Wind</span><strong>${speed(current.wind_speed_10m)}</strong></div><div><span>🌡️ Pressure</span><strong>${Math.round(current.pressure_msl)} hPa</strong></div><div><span>👁️ Visibility</span><strong>${(current.visibility/1000).toFixed(1)} km</strong></div></div>
    <div class="sun-card"><div class="sun-head"><span>☀️ Daylight</span><strong>${Math.round(progress)}%</strong></div><div class="sun-track"><i style="left:${progress}%">☀</i></div><div class="sun-times"><span>🌅 ${formatTime(today.sunrise)}</span><span>🌇 ${formatTime(today.sunset)}</span></div></div>
    <div class="action-row"><button id="shareBtn" class="secondary-action">↗ Share weather</button><span class="updated">Updated ${formatTime(current.time)}</span></div>
  </section>

  <section class="insight-grid section-block">
    <article class="insight"><span>☀ UV INDEX</span><strong>${Math.round(uv)} · ${uvLabel(uv)}</strong><small>Today's peak ${Math.round(today.uv)}</small></article>
    <article class="insight"><span>🌧 RAIN OUTLOOK</span><strong>${rainLabel(today.rain)}</strong><small>${today.rain}% maximum chance</small></article>
    <article class="insight"><span>😌 COMFORT</span><strong>${comfort[0]}</strong><small>${comfort[1]}</small></article>
    <article class="insight"><span>🌡 RANGE</span><strong>${temperature(today.max)} / ${temperature(today.min)}</strong><small>High / Low today</small></article>
  </section>

  <section class="intelligence-card glass section-block"><div class="section-heading"><h3>Today at a glance</h3><span>SkyCast insight</span></div><div class="weather-story"><span class="story-icon">✦</span><div><strong>${escapeHTML(story[0])}</strong><p>${escapeHTML(story[1])}</p></div></div></section>

  <section class="section-block"><div class="section-heading"><h3>Temperature trend</h3><span>Next 12 hours</span></div><div class="chart-card glass"><canvas id="temperatureChart" aria-label="Temperature trend chart"></canvas></div></section>
  <section class="section-block"><div class="section-heading"><h3>Next hours</h3><span>Rain chance & temperature</span></div><div class="hourly-grid">${hourCards}</div></section>
  <section class="section-block"><div class="section-heading"><h3>7-day forecast</h3><span>${formatDate(days[0].date)} → ${formatDate(days.at(-1).date)}</span></div><div class="daily-list">${dayRows}</div></section>
  <p class="source-note">Weather data by Open-Meteo · Forecast refreshes when you search again</p>`;

  document.querySelector("#favoriteBtn")?.addEventListener("click",()=>toggleFavorite(place.name));
  document.querySelector("#shareBtn")?.addEventListener("click",shareWeather);
  requestAnimationFrame(()=>drawTemperatureChart(hourly));
}

async function shareWeather(){
  if(!currentWeather)return;const name=currentWeather.place.name,current=currentWeather.data.current;
  const url=new URL(window.location.href);url.searchParams.set("city",name);const text=`Current weather in ${name}: ${temperature(current.temperature_2m)}, ${weatherInfo(current.weather_code)[0]}.`;
  try{if(navigator.share)await navigator.share({title:`SkyCast — ${name}`,text,url:url.toString()});else if(navigator.clipboard){await navigator.clipboard.writeText(url.toString());setStatus("Weather link copied to clipboard.");setTimeout(()=>setStatus(""),2500);}}catch(error){if(error.name!=="AbortError")setStatus("Couldn't share right now.");}
}

async function searchWeather(city){
  const cleanCity=city.trim();if(!cleanCity){setStatus("Enter a city to get started.");cityInput.focus();return;}
  searchBtn.disabled=true;setStatus(`Finding ${cleanCity}…`);result.innerHTML=`<div class="loading glass"><span></span><p>Loading weather for ${escapeHTML(cleanCity)}…</p></div>`;
  try{const place=await geocodeCity(cleanCity),data=await getWeather(place.latitude,place.longitude);renderWeather(place,data);saveCity(place.name);setStatus("");localStorage.setItem("skycast-last-city",place.name);const url=new URL(window.location.href);url.searchParams.set("city",place.name);window.history.replaceState({},"",url);}
  catch(error){result.innerHTML=`<div class="error glass"><div>⚠️</div><h3>Couldn't get that forecast</h3><p>${escapeHTML(error.message||"Something went wrong.")}</p><button class="secondary-action" id="retryBtn">Try again</button></div>`;document.querySelector("#retryBtn")?.addEventListener("click",()=>searchWeather(cleanCity));setStatus("");}
  finally{searchBtn.disabled=false;}
}

async function useLocation(){
  if(!navigator.geolocation){setStatus("Location is not supported by this browser.");return;}
  locationBtn.disabled=true;setStatus("Finding your location…");
  navigator.geolocation.getCurrentPosition(async position=>{try{const {latitude,longitude}=position.coords,data=await getWeather(latitude,longitude);const place={name:"Your location",latitude,longitude};renderWeather(place,data);setStatus("");localStorage.removeItem("skycast-last-city");}catch(error){setStatus(error.message||"Couldn't load local weather.");}finally{locationBtn.disabled=false;}},()=>{setStatus("Location permission was unavailable. Search for a city instead.");locationBtn.disabled=false;},{enableHighAccuracy:false,timeout:10000,maximumAge:600000});
}

function init(){
  applyTheme();unitToggle.textContent=isCelsius?"°C":"°F";renderQuickCities();
  searchBtn.addEventListener("click",()=>searchWeather(cityInput.value));
  cityInput.addEventListener("keydown",event=>{if(event.key==="Enter")searchWeather(cityInput.value);});
  themeToggle.addEventListener("click",()=>{isDark=!isDark;localStorage.setItem("skycast-theme",isDark?"dark":"light");applyTheme();if(currentWeather)requestAnimationFrame(()=>drawTemperatureChart(getHourly(currentWeather.data)));});
  unitToggle.addEventListener("click",()=>{isCelsius=!isCelsius;localStorage.setItem("skycast-unit",isCelsius?"C":"F");unitToggle.textContent=isCelsius?"°C":"°F";if(currentWeather)renderWeather(currentWeather.place,currentWeather.data);});
  locationBtn.addEventListener("click",useLocation);
  const sharedCity=new URLSearchParams(window.location.search).get("city");const lastCity=localStorage.getItem("skycast-last-city");
  if(sharedCity)searchWeather(sharedCity);else if(lastCity)searchWeather(lastCity);
}

window.renderWeather=renderWeather;
init();
