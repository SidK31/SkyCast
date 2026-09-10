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
let recentCities = JSON.parse(localStorage.getItem("skycast-recent") || "[]");
let favoriteCities = JSON.parse(localStorage.getItem("skycast-favorites") || "[]");

const weatherCodes = {
  0: ["Clear sky", "☀️"], 1: ["Mainly clear", "🌤️"], 2: ["Partly cloudy", "⛅"], 3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"], 48: ["Rime fog", "🌫️"], 51: ["Light drizzle", "🌦️"], 53: ["Drizzle", "🌦️"], 55: ["Heavy drizzle", "🌧️"],
  61: ["Light rain", "🌦️"], 63: ["Rain", "🌧️"], 65: ["Heavy rain", "🌧️"], 71: ["Light snow", "🌨️"], 73: ["Snow", "❄️"],
  75: ["Heavy snow", "❄️"], 80: ["Rain showers", "🌦️"], 81: ["Rain showers", "🌧️"], 82: ["Heavy showers", "⛈️"],
  95: ["Thunderstorm", "⛈️"], 96: ["Thunderstorm + hail", "⛈️"], 99: ["Thunderstorm + hail", "⛈️"]
};

function setStatus(message = "") { status.textContent = message; }
function weatherInfo(code) { return weatherCodes[code] || ["Unknown conditions", "🌡️"]; }
function toFahrenheit(celsius) { return Math.round((celsius * 9) / 5 + 32); }
function temperature(value) { return `${isCelsius ? Math.round(value) : toFahrenheit(value)}°`; }
function formatTime(iso) { return new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(new Date(iso)); }
function formatDay(date) { return new Intl.DateTimeFormat([], { weekday: "short" }).format(new Date(`${date}T12:00:00`)); }
function escapeHTML(value) { return String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[char])); }

function setBackground(code) {
  const name = weatherInfo(code)[0].toLowerCase();
  app.dataset.weather = name.includes("rain") || name.includes("drizzle") || name.includes("storm") ? "rain" : name.includes("snow") ? "snow" : name.includes("cloud") || name.includes("overcast") ? "cloud" : "clear";
}

function saveCity(name) {
  recentCities = [name, ...recentCities.filter(city => city.toLowerCase() !== name.toLowerCase())].slice(0, 5);
  localStorage.setItem("skycast-recent", JSON.stringify(recentCities));
  renderQuickCities();
}

function isFavorite(name) {
  return favoriteCities.some(city => city.toLowerCase() === name.toLowerCase());
}

function toggleFavorite(name) {
  if (isFavorite(name)) {
    favoriteCities = favoriteCities.filter(city => city.toLowerCase() !== name.toLowerCase());
  } else {
    favoriteCities = [name, ...favoriteCities.filter(city => city.toLowerCase() !== name.toLowerCase())].slice(0, 8);
  }
  localStorage.setItem("skycast-favorites", JSON.stringify(favoriteCities));
  renderQuickCities();
  if (currentWeather) renderWeather(currentWeather.place, currentWeather.data);
}

function renderQuickCities() {
  const box = document.querySelector("#quickCities");
  if (!box) return;
  const favorites = favoriteCities.map(city => `<button class="saved-city favorite-city" data-city="${escapeHTML(city)}">★ ${escapeHTML(city)}</button>`).join("");
  const recent = recentCities.filter(city => !isFavorite(city)).map(city => `<button class="saved-city" data-city="${escapeHTML(city)}">📍 ${escapeHTML(city)}</button>`).join("");
  if (!favorites && !recent) {
    box.innerHTML = `<div class="section-heading"><h3>Quick access</h3><span>Search a city to build your shortcuts</span></div>`;
    return;
  }
  box.innerHTML = `<div class="section-heading"><h3>Quick access</h3><span>${favorites ? "Favorites" : "Recent searches"}</span></div><div class="saved-cities">${favorites}${recent}${recentCities.length ? `<button class="clear-cities" id="clearCities">Clear recent</button>` : ""}</div>`;
  box.querySelectorAll(".saved-city").forEach(button => button.addEventListener("click", () => searchWeather(button.dataset.city)));
  box.querySelector("#clearCities")?.addEventListener("click", () => {
    recentCities = [];
    localStorage.removeItem("skycast-recent");
    renderQuickCities();
  });
}

async function geocodeCity(city) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Unable to search for that city.");
  const data = await response.json();
  if (!data.results?.length) throw new Error("City not found. Try another city name.");
  return data.results[0];
}

async function getWeather(latitude, longitude) {
  const params = new URLSearchParams({
    latitude, longitude,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,pressure_msl,visibility",
    hourly: "temperature_2m,precipitation_probability,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max",
    timezone: "auto", forecast_days: "7"
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) throw new Error("Weather data is temporarily unavailable.");
  return response.json();
}

function drawTemperatureChart(hourly) {
  const canvas = document.querySelector("#temperatureChart");
  if (!canvas || !hourly.length) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(320, rect.width);
  const height = 220;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const values = hourly.map(item => isCelsius ? item.temp : toFahrenheit(item.temp));
  const min = Math.floor(Math.min(...values) - 2);
  const max = Math.ceil(Math.max(...values) + 2);
  const pad = { top: 24, right: 18, bottom: 32, left: 42 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const x = i => pad.left + (i / Math.max(values.length - 1, 1)) * plotW;
  const y = value => pad.top + ((max - value) / Math.max(max - min, 1)) * plotH;
  const css = getComputedStyle(document.body);
  const text = css.getPropertyValue("--text").trim();
  const muted = css.getPropertyValue("--muted").trim();
  const line = css.getPropertyValue("--line").trim();
  const accent = css.getPropertyValue("--accent").trim();
  ctx.font = "11px DM Sans, sans-serif";
  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const value = min + ((max - min) / 2) * i;
    const yy = y(value);
    ctx.beginPath(); ctx.moveTo(pad.left, yy); ctx.lineTo(width - pad.right, yy); ctx.stroke();
    ctx.fillStyle = muted; ctx.fillText(`${Math.round(value)}°`, 8, yy + 4);
  }
  ctx.beginPath();
  values.forEach((value, i) => i ? ctx.lineTo(x(i), y(value)) : ctx.moveTo(x(i), y(value)));
  ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
  values.forEach((value, i) => {
    ctx.beginPath(); ctx.arc(x(i), y(value), 3.5, 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill();
    if (i % 3 === 0 || i === values.length - 1) {
      ctx.fillStyle = text; ctx.textAlign = "center"; ctx.fillText(`${Math.round(value)}°`, x(i), y(value) - 10);
      ctx.fillStyle = muted; ctx.fillText(i === 0 ? "Now" : formatTime(hourly[i].time), x(i), height - 10);
    }
  });
  ctx.textAlign = "start";
}

function renderWeather(place, data) {
  currentWeather = { place, data };
  const current = data.current;
  const info = weatherInfo(current.weather_code);
  setBackground(current.weather_code);
  cityInput.value = place.name === "Your location" ? "" : place.name;

  const hourly = data.hourly.time.slice(0, 12).map((time, index) => ({ time, temp: data.hourly.temperature_2m[index], code: data.hourly.weather_code[index], rain: data.hourly.precipitation_probability[index] }));
  const days = data.daily.time.map((date, index) => ({ date, code: data.daily.weather_code[index], max: data.daily.temperature_2m_max[index], min: data.daily.temperature_2m_min[index], rain: data.daily.precipitation_probability_max[index] }));
  const cityName = escapeHTML(place.name);
  const favorite = place.name !== "Your location" && isFavorite(place.name);

  result.innerHTML = `
    <section class="current-card glass">
      <div class="current-main">
        <div><p class="eyebrow">CURRENT WEATHER</p><div class="title-row"><h2>${cityName}${place.country_code ? `, ${escapeHTML(place.country_code)}` : ""}</h2><button id="favoriteBtn" class="round-action ${favorite ? "active" : ""}" title="${favorite ? "Remove from favorites" : "Add to favorites"}" aria-label="${favorite ? "Remove from favorites" : "Add to favorites"}">${favorite ? "★" : "☆"}</button></div><p class="condition">${info[0]}</p><div class="temperature">${temperature(current.temperature_2m)}<span>${isCelsius ? "C" : "F"}</span></div><p class="feels">Feels like ${temperature(current.apparent_temperature)}</p></div>
        <div class="weather-icon" aria-label="${info[0]}">${info[1]}</div>
      </div>
      <div class="metrics"><div><span>💧 Humidity</span><strong>${current.relative_humidity_2m}%</strong></div><div><span>💨 Wind</span><strong>${Math.round(current.wind_speed_10m)} km/h</strong></div><div><span>🌡️ Pressure</span><strong>${Math.round(current.pressure_msl)} hPa</strong></div><div><span>👁️ Visibility</span><strong>${(current.visibility / 1000).toFixed(1)} km</strong></div></div>
      <div class="sun-row"><span>🌅 Sunrise <strong>${formatTime(data.daily.sunrise[0])}</strong></span><span>🌇 Sunset <strong>${formatTime(data.daily.sunset[0])}</strong></span></div>
      <div class="action-row"><button id="shareBtn" class="secondary-action">↗ Share weather</button><span class="updated">Updated ${formatTime(current.time)}</span></div>
    </section>
    <section class="section-block"><div class="section-heading"><h3>Temperature trend</h3><span>Next 12 hours</span></div><div class="chart-card glass"><canvas id="temperatureChart" aria-label="Temperature trend chart"></canvas></div></section>
    <section class="section-block"><div class="section-heading"><h3>Next hours</h3><span>Rain chance & temperature</span></div><div class="hourly-grid">${hourly.map((item, index) => { const itemInfo = weatherInfo(item.code); return `<div class="forecast-item"><span>${index === 0 ? "Now" : formatTime(item.time)}</span><b>${itemInfo[1]}</b><strong>${temperature(item.temp)}</strong><small>${item.rain ?? 0}% rain</small></div>`; }).join("")}</div></section>
    <section class="section-block"><div class="section-heading"><h3>7-day forecast</h3><span>Plan ahead</span></div><div class="daily-list">${days.map((day, index) => { const dayInfo = weatherInfo(day.code); return `<div class="day-row"><strong>${index === 0 ? "Today" : formatDay(day.date)}</strong><span class="day-condition">${dayInfo[1]} ${dayInfo[0]}</span><span>💧 ${day.rain ?? 0}%</span><strong>${temperature(day.max)} <em>${temperature(day.min)}</em></strong></div>`; }).join("")}</div></section>
    <p class="source-note">Weather data by Open-Meteo</p>`;

  document.querySelector("#favoriteBtn")?.addEventListener("click", () => toggleFavorite(place.name));
  document.querySelector("#shareBtn")?.addEventListener("click", shareWeather);
  requestAnimationFrame(() => drawTemperatureChart(hourly));
}

async function shareWeather() {
  if (!currentWeather) return;
  const name = currentWeather.place.name;
  const url = new URL(window.location.href);
  url.searchParams.set("city", name);
  const text = `Current weather in ${name}: ${temperature(currentWeather.data.current.temperature_2m)}, ${weatherInfo(currentWeather.data.current.weather_code)[0]}.`;
  try {
    if (navigator.share) await navigator.share({ title: `SkyCast — ${name}`, text, url: url.toString() });
    else if (navigator.clipboard) { await navigator.clipboard.writeText(url.toString()); setStatus("Weather link copied to clipboard."); setTimeout(() => setStatus(""), 2500); }
  } catch (error) {
    if (error.name !== "AbortError") setStatus("Couldn't share right now.");
  }
}

async function searchWeather(city) {
  const cleanCity = city.trim();
  if (!cleanCity) { setStatus("Enter a city to get started."); return; }
  searchBtn.disabled = true;
  setStatus("Finding your forecast…");
  result.innerHTML = `<div class="loading glass"><span></span><p>Loading weather for ${escapeHTML(cleanCity)}…</p></div>`;
  try {
    const place = await geocodeCity(cleanCity);
    const data = await getWeather(place.latitude, place.longitude);
    renderWeather(place, data);
    saveCity(place.name);
    setStatus("");
    localStorage.setItem("skycast-last-city", place.name);
    const url = new URL(window.location.href);
    url.searchParams.set("city", place.name);
    window.history.replaceState({}, "", url);
  } catch (error) {
    result.innerHTML = `<div class="error glass"><div>⚠️</div><h3>Couldn't get that forecast</h3><p>${escapeHTML(error.message)}</p></div>`;
    setStatus("");
  } finally { searchBtn.disabled = false; }
}

async function useLocation() {
  if (!navigator.geolocation) { setStatus("Location is not supported by this browser."); return; }
  setStatus("Getting your location…");
  navigator.geolocation.getCurrentPosition(async ({ coords }) => {
    try {
      const data = await getWeather(coords.latitude, coords.longitude);
      renderWeather({ name: "Your location", country_code: "", latitude: coords.latitude, longitude: coords.longitude }, data);
      setStatus("");
    } catch (error) { setStatus(error.message); }
  }, () => setStatus("Location access was unavailable. Search for a city instead."), { enableHighAccuracy: true, timeout: 10000 });
}

function applyTheme() {
  document.body.dataset.theme = isDark ? "dark" : "light";
  themeToggle.textContent = isDark ? "☾" : "☀";
  themeToggle.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark ? "#07111f" : "#eef5fb");
}

searchBtn.addEventListener("click", () => searchWeather(cityInput.value));
cityInput.addEventListener("keydown", event => { if (event.key === "Enter") searchWeather(cityInput.value); });
locationBtn.addEventListener("click", useLocation);
unitToggle.textContent = isCelsius ? "°C" : "°F";
unitToggle.addEventListener("click", () => { isCelsius = !isCelsius; localStorage.setItem("skycast-unit", isCelsius ? "C" : "F"); unitToggle.textContent = isCelsius ? "°C" : "°F"; if (currentWeather) renderWeather(currentWeather.place, currentWeather.data); });
themeToggle.addEventListener("click", () => { isDark = !isDark; localStorage.setItem("skycast-theme", isDark ? "dark" : "light"); applyTheme(); if (currentWeather) renderWeather(currentWeather.place, currentWeather.data); });
window.addEventListener("resize", () => { if (currentWeather) { const canvas = document.querySelector("#temperatureChart"); if (canvas) drawTemperatureChart(currentWeather.data.hourly.time.slice(0, 12).map((time, index) => ({ time, temp: currentWeather.data.hourly.temperature_2m[index] }))); } });

applyTheme();
renderQuickCities();
const requestedCity = new URLSearchParams(window.location.search).get("city");
const lastCity = localStorage.getItem("skycast-last-city");
searchWeather(requestedCity || lastCity || "Mumbai");
