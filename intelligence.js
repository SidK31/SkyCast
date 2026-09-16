/* SkyCast weather intelligence. Uses existing Open-Meteo data only. */
(() => {
  const result = document.querySelector('#result');
  if (!result) return;
  const celsius = () => localStorage.getItem('skycast-unit') !== 'F';
  const temp = value => {
    if (value == null || Number.isNaN(Number(value))) return '—';
    const n = celsius() ? Number(value) : Number(value) * 9 / 5 + 32;
    return `${Math.round(n)}°`;
  };

  function build() {
    const data = typeof window.skycastGetWeather === 'function' ? window.skycastGetWeather() : null;
    if (!data?.data?.hourly || !data?.data?.daily) return;
    const old = result.querySelector('.intelligence-grid');
    if (old) old.remove();
    const weather = data.data, current = weather.current || {}, times = weather.hourly.time || [];
    const startIndex = times.findIndex(t => t >= current.time);
    const start = startIndex < 0 ? 0 : startIndex;
    const hours = times.slice(start, start + 12).map((time, i) => {
      const n = start + i;
      return { time, temp: weather.hourly.temperature_2m?.[n], rain: weather.hourly.precipitation_probability?.[n] ?? 0, wind: weather.hourly.wind_speed_10m?.[n] ?? 0 };
    });
    if (!hours.length) return;
    const daytime = hours.filter(x => { const h = Number(String(x.time).slice(11,13)); return h >= 7 && h <= 20; });
    const candidates = daytime.length ? daytime : hours;
    const score = x => Number(x.rain) * 1.5 + Math.abs(Number(x.temp) - 24) * 2 + Math.max(0, Number(x.wind) - 25);
    const best = [...candidates].sort((a,b) => score(a) - score(b))[0];
    const h = Number(String(best.time).slice(11,13)), m = String(best.time).slice(14,16);
    const bestTime = `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
    const rain = Number(best.rain), tempNow = Number(current.temperature_2m), humidity = Number(current.relative_humidity_2m || 0), uv = Number(current.uv_index || 0), wind = Number(current.wind_speed_10m || 0);
    let outfit = 'Light, comfortable clothes', outfitIcon = '👕';
    if (tempNow < 12) { outfit = 'Warm layers recommended'; outfitIcon = '🧥'; }
    else if (tempNow < 20) { outfit = 'Light jacket or long sleeves'; outfitIcon = '🧥'; }
    else if (tempNow >= 32) { outfit = 'Breathable, lightweight clothes'; outfitIcon = '🩳'; }
    if (rain >= 50) outfit += ' + umbrella';
    let activity = 'Great for outdoor plans', activityIcon = '🚶', activityClass = 'good';
    if (rain >= 60) { activity = 'Keep outdoor plans flexible'; activityIcon = '☔'; activityClass = 'caution'; }
    else if (tempNow >= 35 || tempNow <= 8) { activity = 'Take it easy outdoors'; activityIcon = '🌡️'; activityClass = 'caution'; }
    else if (uv >= 8) { activity = 'Outdoor plans need sun protection'; activityIcon = '🧴'; activityClass = 'caution'; }
    const rainText = rain < 20 ? 'Low rain chance' : rain < 50 ? 'Some rain possible' : 'Rain likely';
    const section = document.createElement('section');
    section.className = 'intelligence-grid section-block';
    section.innerHTML = `<div class="intel-heading"><div><p class="eyebrow">WEATHER INTELLIGENCE</p><h3>Plan your day smarter</h3></div><span>Live forecast</span></div><div class="intel-cards"><article class="intel-card best-time"><span class="intel-icon">⏱️</span><div><small>BEST TIME OUTDOORS</small><strong>${bestTime}</strong><p>${Math.round(rain)}% rain · ${temp(best.temp)} · ${Math.round(best.wind)} km/h wind</p></div></article><article class="intel-card"><span class="intel-icon">${outfitIcon}</span><div><small>WHAT TO WEAR</small><strong>${outfit}</strong><p>${uv <= 2 ? 'Low UV today.' : uv <= 5 ? 'Consider sun protection.' : 'Sun protection recommended.'}</p></div></article><article class="intel-card ${activityClass}"><span class="intel-icon">${activityIcon}</span><div><small>OUTDOOR OUTLOOK</small><strong>${activity}</strong><p>${rainText} · ${humidity}% humidity · ${Math.round(wind)} km/h wind</p></div></article></div>`;
    result.appendChild(section);
  }
  const observer = new MutationObserver(() => requestAnimationFrame(build));
  observer.observe(result, { childList: true });
  window.addEventListener('load', () => setTimeout(build, 150));
})();
