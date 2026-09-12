/* SkyCast smart search + accessibility polish. No API keys. */
(() => {
  const input = document.querySelector('#cityInput');
  const form = document.querySelector('#searchForm');
  if (!input || !form) return;

  const wrap = input.closest('.search-wrap');
  if (!wrap) return;
  wrap.classList.add('smart-search');

  const list = document.createElement('div');
  list.id = 'citySuggestions';
  list.className = 'city-suggestions';
  list.setAttribute('role', 'listbox');
  list.hidden = true;
  wrap.appendChild(list);

  let timer = null;
  let controller = null;
  let results = [];
  let active = -1;

  function close() {
    list.hidden = true;
    active = -1;
  }

  function render(items) {
    results = items.slice(0, 5);
    active = -1;
    if (!results.length) return close();
    list.innerHTML = results.map((place, i) => {
      const region = [place.admin1, place.country].filter(Boolean).join(', ');
      return `<button type="button" class="suggestion" role="option" aria-selected="false" data-index="${i}"><span class="suggestion-icon">⌖</span><span><strong>${escapeHTML(place.name)}</strong><small>${escapeHTML(region)}</small></span></button>`;
    }).join('');
    list.hidden = false;
    list.querySelectorAll('.suggestion').forEach(btn => btn.addEventListener('click', () => choose(Number(btn.dataset.index))));
  }

  function choose(index) {
    const place = results[index];
    if (!place) return;
    input.value = place.name;
    close();
    if (typeof searchWeather === 'function') searchWeather(place.name);
  }

  async function suggest(query) {
    const clean = query.trim();
    if (clean.length < 2) return close();
    controller?.abort();
    controller = new AbortController();
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(clean)}&count=5&language=en&format=json`;
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) return close();
      const data = await response.json();
      render((data.results || []).filter(x => x.name));
    } catch (error) {
      if (error.name !== 'AbortError') close();
    }
  }

  input.setAttribute('aria-controls', 'citySuggestions');
  input.setAttribute('aria-autocomplete', 'list');
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => suggest(input.value), 280);
  });
  input.addEventListener('focus', () => { if (input.value.trim().length >= 2) suggest(input.value); });
  input.addEventListener('keydown', event => {
    if (list.hidden || !results.length) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); active = (active + 1) % results.length; updateActive(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); active = (active - 1 + results.length) % results.length; updateActive(); }
    else if (event.key === 'Enter' && active >= 0) { event.preventDefault(); choose(active); }
    else if (event.key === 'Escape') close();
  });
  document.addEventListener('click', event => { if (!wrap.contains(event.target)) close(); });

  function updateActive() {
    list.querySelectorAll('.suggestion').forEach((el, i) => {
      const selected = i === active;
      el.classList.toggle('active', selected);
      el.setAttribute('aria-selected', String(selected));
    });
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
  }
})();
