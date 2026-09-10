const cityInput = document.querySelector("#cityInput");
const searchBtn = document.querySelector("#searchBtn");
const locationBtn = document.querySelector("#locationBtn");
const unitToggle = document.querySelector("#unitToggle");
const result = document.querySelector("#result");
const status = document.querySelector("#status");
const app = document.querySelector("#app");

let currentWeather = null;
let isCelsius = true;

const weatherCodes = {
  0: ["Clear sky", "☀️"],
  1: ["Mainly clear", "🌤️"],
  2: ["Partly cloudy", "⛅"],
  3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"],
  48: ["Rime fog", "🌫️"],
  51: ["Light drizzle", "🌦️"],
  53: ["Drizzle", "🌦️"],
  55: ["Heavy drizzle", "🌧️"],
  61: ["Light rain", "🌦️"],
  63: ["Rain", "🌧️"],
  65: ["Heavy rain", "🌧️"],
  71: ["Light snow", "🌨️"],
  73: ["Snow", "❄️"],
  75: ["Heavy snow", "❄️"],
  80: ["Rain showers", "🌦️"],
  81: ["Rain showers", "🌧️"],
  82: ["Heavy showers", "⛈️"],
  95: ["Thunderstorm", "⛈️"],
  96: ["Thunderstorm + hail", "⛈️"],
  99: ["Thunderstorm + hail", "⛈️"]
};

function setStatus(message = "") {
  status.textContent = message;
}

function weatherInfo(code) {
  return weatherCodes[code] || ["Unknown conditions", "🌡️"];
}

function toFahrenheit(celsius) {
  return Math.round((celsius * 9) / 5 + 32);
}

function temperature(value) {
  return `${isCelsius ? Math.round(value) : toFahrenheit(value)}°`;
}

function formatTime(iso) {
  return new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

function formatDay(date) {
  return new Intl.DateTimeFormat([], { weekday: "short" }).format(new Date(`${date}T12:00:00`));
}

function setBackground(code) {
  const name = weatherInfo(code)[0].toLowerCase();
  app.dataset.weather = name.includes("rain") || name.includes("drizzle") || name.includes("storm") ? "rain" : name.includes("snow") ? "snow" : name.includes("cloud") || name.includes("overcast") ? "cloud" : "clear";
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
    latitude,
    longitude,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,pressure_msl,visibility",
    hourly: "temperature_2m,precipitation_probability,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "7"
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) throw new Error("Weather data is temporarily unavailable.");
  return response.json();
}

function renderWeather(place, data) {
  currentWeather = { place, data };
  const current = data.current;
  const info = weatherInfo(current.weather_code);
  setBackground(current.weather_code);

  const hourly = data.hourly.time.slice(0, 12).map((time, index) => ({
    time,
    temp: data.hourly.temperature_2m[index],
    code: data.hourly.weather_code[index],
    rain: data.hourly.precipitation_probability[index]
  }));

  const days = data.daily.time.map((date, index) => ({
    date,
    code: data.daily.weather_code[index],
    max: data.daily.temperature_2m_max[index],
    min: data.daily.temperature_2m_min[index],
    rain: data.daily.precipitation_probability_max[index]
  }));

  result.innerHTML = `
    <section class="current-card glass">
      <div class="current-main">
        <div>
          <p class="eyebrow">CURRENT WEATHER</p>
          <h2>${place.name}${place.country_code ? `, ${place.country_code}` : ""}</h2>
          <p class="condition">${info[0]}</p>
          <div class="temperature">${temperature(current.temperature_2m)}<span>${isCelsius ? "C" : "F"}</span></div>
          <p class="feels">Feels like ${temperature(current.apparent_temperature)}</p>
        </div>
        <div class="weather-icon" aria-label="${info[0]}">${info[1]}</div>
      </div>
      <div class="metrics">
        <div><span>💧 Humidity</span><strong>${current.relative_humidity_2m}%</strong></div>
        <div><span>💨 Wind</span><strong>${Math.round(current.wind_speed_10m)} km/h</strong></div>
        <div><span>🌡️ Pressure</span><strong>${Math.round(current.pressure_msl)} hPa</strong></div>
        <div><span>👁️ Visibility</span><strong>${(current.visibility / 1000).toFixed(1)} km</strong></div>
      </div>
      <div class="sun-row">
        <span>🌅 Sunrise <strong>${formatTime(data.daily.sunrise[0])}</strong></span>
        <span>🌇 Sunset <strong>${formatTime(data.daily.sunset[0])}</strong></span>
      </div>
    </section>

    <section class="section-block">
      <div class="section-heading"><h3>Next hours</h3><span>Rain chance & temperature</span></div>
      <div class="hourly-grid">${hourly.map((item, index) => {
        const itemInfo = weatherInfo(item.code);
        return `<div class="forecast-item"><span>${index === 0 ? "Now" : formatTime(item.time)}</span><b>${itemInfo[1]}</b><strong>${temperature(item.temp)}</strong><small>${item.rain ?? 0}% rain</small></div>`;
      }).join("")}</div>
    </section>

    <section class="section-block">
      <div class="section-heading"><h3>7-day forecast</h3><span>Plan ahead</span></div>
      <div class="daily-list">${days.map((day, index) => {
        const dayInfo = weatherInfo(day.code);
        return `<div class="day-row"><strong>${index === 0 ? "Today" : formatDay(day.date)}</strong><span class="day-condition">${dayInfo[1]} ${dayInfo[0]}</span><span>💧 ${day.rain ?? 0}%</span><strong>${temperature(day.max)} <em>${temperature(day.min)}</em></strong></div>`;
      }).join("")}</div>
    </section>
    <p class="source-note">Weather data by Open-Meteo • Updated ${formatTime(current.time)}</p>
  `;
}

async function searchWeather(city) {
  const cleanCity = city.trim();
  if (!cleanCity) {
    setStatus("Enter a city to get started.");
    return;
  }

  searchBtn.disabled = true;
  setStatus("Finding your forecast…");
  result.innerHTML = `<div class="loading glass"><span></span><p>Loading weather for ${cleanCity}…</p></div>`;

  try {
    const place = await geocodeCity(cleanCity);
    const data = await getWeather(place.latitude, place.longitude);
    renderWeather(place, data);
    setStatus("");
    localStorage.setItem("skycast-last-city", place.name);
  } catch (error) {
    result.innerHTML = `<div class="error glass"><div>⚠️</div><h3>Couldn't get that forecast</h3><p>${error.message}</p></div>`;
    setStatus("");
  } finally {
    searchBtn.disabled = false;
  }
}

async function useLocation() {
  if (!navigator.geolocation) {
    setStatus("Location is not supported by this browser.");
    return;
  }

  setStatus("Getting your location…");
  navigator.geolocation.getCurrentPosition(async ({ coords }) => {
    try {
      const data = await getWeather(coords.latitude, coords.longitude);
      const place = { name: "Your location", country_code: "", latitude: coords.latitude, longitude: coords.longitude };
      renderWeather(place, data);
      setStatus("");
    } catch (error) {
      setStatus(error.message);
    }
  }, () => setStatus("Location access was unavailable. Search for a city instead."), { enableHighAccuracy: true, timeout: 10000 });
}

searchBtn.addEventListener("click", () => searchWeather(cityInput.value));
cityInput.addEventListener("keydown", event => {
  if (event.key === "Enter") searchWeather(cityInput.value);
});
locationBtn.addEventListener("click", useLocation);
unitToggle.addEventListener("click", () => {
  isCelsius = !isCelsius;
  unitToggle.textContent = isCelsius ? "°C" : "°F";
  if (currentWeather) renderWeather(currentWeather.place, currentWeather.data);
});

const lastCity = localStorage.getItem("skycast-last-city");
searchWeather(lastCity || "Mumbai");
