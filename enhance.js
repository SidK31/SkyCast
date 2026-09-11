/* SkyCast 2.1 intelligence layer — additive, API-key free. */
(() => {
  const originalRender = window.renderWeather;
  if (typeof originalRender !== "function") return;
  window.renderWeather = function(place, data) {
    originalRender(place, data);
    addIntelligence(place, data);
  };

  async function addIntelligence(place, data) {
    const current = data.current;
    const daily = data.daily;
    const hourly = data.hourly;
    const todayRain = daily.precipitation_probability_max?.[0] ?? 0;
    const high = daily.temperature_2m_max?.[0];
    const low = daily.temperature_2m_min?.[0];
    const [comfort, comfortText] = SKYCAST_INSIGHTS.comfort(current.temperature_2m, current.relative_humidity_2m);
    const rainLabel = SKYCAST_INSIGHTS.rainLabel(todayRain);
    const story = makeStory(current, todayRain, high, low);

    const anchor = document.querySelector(".current-card");
    if (!anchor) return;
    const existing = document.querySelector("#skycastIntelligence");
    existing?.remove();

    const section = document.createElement("section");
    section.id = "skycastIntelligence";
    section.className = "intelligence-card glass section-block";
    section.innerHTML = `
      <div class="section-heading"><h3>Today at a glance</h3><span>SkyCast insight</span></div>
      <div class="weather-story"><span class="story-icon">✦</span><div><strong>${story.title}</strong><p>${story.text}</p></div></div>
      <div class="insight-grid">
        <div class="insight"><span>🌡️ Today's range</span><strong>${temperature(high)} / ${temperature(low)}</strong><small>High / Low</small></div>
        <div class="insight"><span>🌧️ Rain outlook</span><strong>${rainLabel}</strong><small>${todayRain}% maximum chance</small></div>
        <div class="insight"><span>😌 Comfort</span><strong>${comfort}</strong><small>${comfortText}</small></div>
      </div>`;
    anchor.insertAdjacentElement("afterend", section);

    // Open-Meteo air-quality endpoint is queried separately so existing forecast behavior stays resilient.
    try {
      const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
      url.searchParams.set("latitude", place.latitude);
      url.searchParams.set("longitude", place.longitude);
      url.searchParams.set("current", "us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide");
      url.searchParams.set("timezone", "auto");
      const response = await fetch(url);
      if (!response.ok) return;
      const air = await response.json();
      const aq = air.current;
      if (!aq) return;
      const aqi = Math.round(aq.us_aqi ?? 0);
      const label = aqi <= 50 ? "Good" : aqi <= 100 ? "Moderate" : aqi <= 150 ? "Unhealthy for sensitive groups" : aqi <= 200 ? "Unhealthy" : "Poor";
      section.querySelector(".insight-grid").insertAdjacentHTML("beforeend", `<div class="insight"><span>🌫️ Air quality</span><strong>${label}</strong><small>US AQI ${aqi} · PM2.5 ${Math.round(aq.pm2_5 ?? 0)} µg/m³</small></div>`);
    } catch (_) { /* Weather remains fully usable if AQ is unavailable. */ }
  }

  function makeStory(current, rain, high, low) {
    const code = current.weather_code;
    const [condition] = weatherInfo(code);
    if ([95,96,99].includes(code)) return { title: "Stormy conditions possible", text: `Expect ${condition.toLowerCase()} conditions. Keep outdoor plans flexible and watch local alerts.` };
    if (rain >= 70) return { title: "Carry an umbrella today", text: `${rain}% is the peak rain chance today, with a high around ${temperature(high)}.` };
    if (rain >= 40) return { title: "Keep an eye on the clouds", text: `There is a moderate chance of rain today. Temperatures range from ${temperature(low)} to ${temperature(high)}.` };
    if (high >= 35) return { title: "It's a hot one", text: `The temperature may reach ${temperature(high)}. Stay hydrated and limit prolonged midday exposure.` };
    if (high <= 12) return { title: "A chilly day ahead", text: `Temperatures stay cool, from ${temperature(low)} to ${temperature(high)}. A warm layer may help.` };
    return { title: `${condition} — looking comfortable`, text: `A high near ${temperature(high)} with a low around ${temperature(low)}. Rain risk is relatively low.` };
  }
})();
