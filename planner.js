/* SkyCast 2.4 — compare cities + travel planner. No API keys. */
(() => {
  const quick = document.querySelector('#quickCities');
  const result = document.querySelector('#result');
  if (!quick || !result) return;

  const geo = async city => {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
    if (!r.ok) throw new Error('Location search failed.');
    const j = await r.json();
    if (!j.results?.length) throw new Error(`Couldn't find ${city}.`);
    return j.results[0];
  };

  const weather = async place => {
    const p = new URLSearchParams({
      latitude: place.latitude, longitude: place.longitude,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,uv_index',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max',
      timezone: 'auto', forecast_days: '7'
    });
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?${p}`);
    if (!r.ok) throw new Error('Weather data is temporarily unavailable.');
    return r.json();
  };

  const codes = {
    0:['Clear sky','☀️'],1:['Mainly clear','🌤️'],2:['Partly cloudy','⛅'],3:['Overcast','☁️'],45:['Fog','🌫️'],48:['Rime fog','🌫️'],
    51:['Light drizzle','🌦️'],53:['Drizzle','🌦️'],55:['Heavy drizzle','🌧️'],61:['Light rain','🌦️'],63:['Rain','🌧️'],65:['Heavy rain','🌧️'],
    71:['Light snow','🌨️'],73:['Snow','❄️'],75:['Heavy snow','❄️'],80:['Rain showers','🌦️'],81:['Rain showers','🌧️'],82:['Heavy showers','⛈️'],
    95:['Thunderstorm','⛈️'],96:['Thunderstorm + hail','⛈️'],99:['Thunderstorm + hail','⛈️']
  };
  const info = c => codes[c] || ['Unknown','🌡️'];
  const unit = () => localStorage.getItem('skycast-unit') === 'F';
  const t = v => `${Math.round(unit() ? v * 9 / 5 + 32 : v)}°`;
  const day = iso => new Intl.DateTimeFormat([], { weekday:'short', month:'short', day:'numeric' }).format(new Date(`${iso}T12:00:00`));
  const esc = v => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  function launcher() {
    if (document.querySelector('#plannerLaunchers')) return;
    const section = document.createElement('section');
    section.id = 'plannerLaunchers';
    section.className = 'planner-launchers glass';
    section.innerHTML = `<div><p class="eyebrow">PLAN WITH SKYCAST</p><h3>Make weather decisions easier</h3><p>Compare places or check the weather before a trip.</p></div><div class="planner-actions"><button id="compareOpen" type="button">⚔️ Compare cities</button><button id="travelOpen" type="button">✈️ Travel mode</button></div>`;
    quick.parentNode.insertBefore(section, result);
    document.querySelector('#compareOpen').addEventListener('click', () => openModal('compare'));
    document.querySelector('#travelOpen').addEventListener('click', () => openModal('travel'));
  }

  function openModal(mode) {
    document.querySelector('#plannerModal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'plannerModal';
    modal.className = 'planner-modal';
    const compare = mode === 'compare';
    modal.innerHTML = `<div class="planner-backdrop"></div><div class="planner-dialog glass" role="dialog" aria-modal="true" aria-labelledby="plannerTitle"><button class="planner-close" aria-label="Close">×</button><p class="eyebrow">${compare?'CITY COMPARISON':'TRAVEL MODE'}</p><h2 id="plannerTitle">${compare?'Compare two cities':'Plan a trip'}</h2><p class="planner-help">${compare?'See the same weather signals side by side.':'Choose a destination and get a simple 7-day planning view.'}</p>${compare ? '<div class="planner-fields"><input id="plannerA" placeholder="First city" autocomplete="off"><input id="plannerB" placeholder="Second city" autocomplete="off"></div>' : '<div class="planner-fields"><input id="plannerFrom" placeholder="Starting city (optional)" autocomplete="off"><input id="plannerTo" placeholder="Destination city" autocomplete="off"></div>'}<button id="plannerGo" class="planner-go">${compare?'Compare now':'Check trip weather'}</button><p id="plannerStatus" class="planner-status"></p><div id="plannerOutput"></div></div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.planner-close').onclick = close;
    modal.querySelector('.planner-backdrop').onclick = close;
    modal.querySelector('#plannerGo').onclick = async () => compare ? doCompare(modal) : doTravel(modal);
    modal.querySelector(compare ? '#plannerA' : '#plannerTo').focus();
  }

  async function doCompare(modal) {
    const a = modal.querySelector('#plannerA').value.trim(), b = modal.querySelector('#plannerB').value.trim();
    if (!a || !b) return modal.querySelector('#plannerStatus').textContent = 'Enter two cities to compare.';
    const status = modal.querySelector('#plannerStatus'); status.textContent = 'Loading both forecasts…';
    try {
      const [pa,pb] = await Promise.all([geo(a),geo(b)]), [wa,wb] = await Promise.all([weather(pa),weather(pb)]);
      const rows = [['Temperature',t(wa.current.temperature_2m),t(wb.current.temperature_2m)],['Feels like',t(wa.current.apparent_temperature),t(wb.current.apparent_temperature)],['Rain chance',`${wa.daily.precipitation_probability_max?.[0]??0}%`,`${wb.daily.precipitation_probability_max?.[0]??0}%`],['Humidity',`${wa.current.relative_humidity_2m}%`,`${wb.current.relative_humidity_2m}%`],['Wind',`${Math.round(wa.current.wind_speed_10m)} km/h`,`${Math.round(wb.current.wind_speed_10m)} km/h`],['UV',`${Math.round(wa.current.uv_index??0)} · ${info(wa.current.weather_code)[0]}`,`${Math.round(wb.current.uv_index??0)} · ${info(wb.current.weather_code)[0]}`]];
      modal.querySelector('#plannerStatus').textContent = '';
      modal.querySelector('#plannerOutput').innerHTML = `<div class="compare-head"><div>${info(wa.current.weather_code)[1]} <strong>${esc(pa.name)}</strong></div><div>${info(wb.current.weather_code)[1]} <strong>${esc(pb.name)}</strong></div></div><div class="compare-table">${rows.map(r=>`<div><span>${r[0]}</span><strong>${r[1]}</strong><strong>${r[2]}</strong></div>`).join('')}</div>`;
    } catch(e) { status.textContent = e.message || 'Something went wrong.'; }
  }

  async function doTravel(modal) {
    const to = modal.querySelector('#plannerTo').value.trim(), from = modal.querySelector('#plannerFrom').value.trim();
    if (!to) return modal.querySelector('#plannerStatus').textContent = 'Enter a destination.';
    const status = modal.querySelector('#plannerStatus'); status.textContent = 'Building your trip forecast…';
    try {
      const dest = await geo(to), data = await weather(dest), d = data.daily;
      const rows = (d.time||[]).slice(0,7).map((date,i)=>{ const [name,icon]=info(d.weather_code[i]); return `<div class="travel-day"><span>${day(date)}</span><b>${icon} ${name}</b><strong>${t(d.temperature_2m_max[i])} <em>${t(d.temperature_2m_min[i])}</em></strong><small>💧 ${d.precipitation_probability_max?.[i]??0}% rain</small></div>`; }).join('');
      const rain = Math.max(...(d.precipitation_probability_max||[0]).slice(0,7));
      const high = Math.max(...d.temperature_2m_max.slice(0,7));
      const tip = rain >= 70 ? 'Pack rain protection and keep outdoor plans flexible.' : high >= 35 ? 'Pack light clothing, hydration and strong sun protection.' : 'Pack layers appropriate for changing daily conditions.';
      status.textContent = '';
      modal.querySelector('#plannerOutput').innerHTML = `<div class="travel-summary"><div><small>${from ? `${esc(from)} → ` : ''}DESTINATION</small><h3>${esc(dest.name)}, ${esc(dest.country||'')}</h3><p>${tip}</p></div><span>${info(data.current.weather_code)[1]}</span></div><div class="travel-list">${rows}</div>`;
    } catch(e) { status.textContent = e.message || 'Something went wrong.'; }
  }

  launcher();
})();
