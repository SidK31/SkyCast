/* SkyCast weather intelligence. Uses existing Open-Meteo data only. */
(() => {
  const result = document.querySelector('#result');
  if (!result) return;

  const weatherCodes = window.skycastWeatherCodes || {};
  const getInfo = code => weatherCodes[code] || ['Unknown conditions', '🌡️', 'unknown'];
  const celsius = () => localStorage.getItem('skycast-unit') !== 'F';
  const temp = value => {
    if (value == null || Number.isNaN(Number(value))) return '—';
    const n = celsius() ? Number(value) : Number(value) * 9 / 5 + 32;
    return `${Math.round(n)}°`;
  };

  function build() {
    const data = window.currentWeather;
    if (!data?.data?.hourly || !data?.data?.daily) return;
    const old = result.querySelector('.intelligence-grid');
    if (old) old.remove();

    const weather = data.data;
    const current = weather.current || {};
    const times = weather.hourly.time || [];
    const start = Math.max(0, times.findIndex(t => t >= current.time));
    const hours = times.slice(start, start + 12).map((time, i) => {
      const n = start + i;
      return {
        time,
        temp: weather.hourly.temperature_2m?.[n],
        rain: weather.hourly.precipitation_probability?.[n] ?? 0,
        code: weather.hourly.weather_code?.[n],
        wind: weather.hourly.wind_speed_10m?.[n] ?? 0,
        uv: weather.hourly.uv_index?.[n] ?? 0
      };
    });
    if (!hours.length) return;

    const daytime = hours.filter(h => {
      const hour = Number(String(h.time).slice(11, 13));
      return hour >= 7 && hour <= 20;
    });
    const candidates = daytime.length ? daytime : hours;
    const best = [...candidates].sort((a, b) => {
      const score = h => (h.rain * 1.5) + Math.abs(Number(h.temp) - 24) * 2 + Math.max(0, h.wind - 25) + Math.max(0, h.uv - 7) * 4;
      return score(a) - score(b);
    })[0];

    const h = Number(String(best.time).slice(11, 13));
    const m = String(best.time).slice(14, 16);
    const bestTime = `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
    const rain = Number(best.rain);
    const tempNow = Number(current.temperature_2m);
    const humidity = Number(current.relative_humidity_2m);
    const uv = Number(current.uv_index ?? 0);
    const wind = Number(current.wind_speed_10m ?? 0);

    let outfit = 'Light, comfortable clothes';
    let outfitIcon = '👕';
    if (tempNow < 12) { outfit = 'Warm layers recommended'; outfitIcon = '🧥'; }
    else if (tempNow < 20) { outfit = 'Light jacket or long sleeves'; outfitIcon = '🧥'; }
    else if (tempNow >= 32) { outfit = 'Breathable, lightweight clothes'; outfitIcon = '🩳'; }
    if (rain >= 50) outfit += ' + umbrella';

    let activity = 'Great for outdoor plans';
    let activityIcon = '🚶';
    let activityClass = 'good';
    if (rain >= 60) { activity = 'Keep outdoor plans flexible'; activityIcon = '☔'; activityClass = 'caution'; }
    else if (tempNow >= 35 || tempNow <= 8) { activity = 'Take it easy outdoors'; activityIcon = '🌡️'; activityClass = 'caution'; }
    else if (uv >= 8) { activity = 'Outdoor plans need sun protection'; activityIcon = '🧴'; activityClass = 'caution'; }

    const rainText = rain < 20 ? 'Low rain chance' : rain < 50 ? 'Some rain possible' : 'Rain likely';
    const why = `${Math.round(best.rain)}% rain · ${temp(best.temp)} · ${Math.round(best.wind)} km/h wind`;

    const section = document.createElement('section');
    section.className = 'intelligence-grid section-block';
    section.innerHTML = `
      <div class="intel-heading"><div><p class="eyebrow">WEATHER INTELLIGENCE</p><h3>Plan your day smarter</h3></div><span>Live forecast</span></div>
      <div class="intel-cards">
        <article class="intel-card best-time"><span class="intel-icon">⏱️</span><div><small>BEST TIME OUTDOORS</small><strong>${bestTime}</strong><p>${why}</p></div></article>
        <article class="intel-card"><span class="intel-icon">${outfitIcon}</span><div><small>WHAT TO WEAR</small><strong>${outfit}</strong><p>${uv <= 2 ? 'Low UV today.' : uv <= 5 ? 'Consider sun protection.' : 'Sun protection recommended.'}</p></div></article>
        <article class="intel-card ${activityClass}"><span class="intel-icon">${activityIcon}</span><div><small>OUTDOOR OUTLOOK</small><strong>${activity}</strong><p>${rainText} · ${humidity}% humidity · ${Math.round(wind)} km/h wind</p></div></article>
      </div>`;
    result.appendChild(section);
  }

  const observer = new MutationObserver(() => requestAnimationFrame(build));
  observer.observe(result, { childList: true });
  window.addEventListener('load', () => setTimeout(build, 100));
  window.addEventListener('skycast:weather-updated', build);
})();
