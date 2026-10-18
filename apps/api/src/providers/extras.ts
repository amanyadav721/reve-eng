import type { SearchProvider, WeatherProvider } from './types.js';

// Optional providers. The planner works without them; it just can't adapt to weather or cite the web.

/** OpenWeather One Call 3.0. Hourly data covers the next 48 hours only. */
export function openWeather(apiKey: string, fetchImpl: typeof fetch = fetch): WeatherProvider {
  return {
    async hourly(at, date) {
      const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${at.lat}&lon=${at.lng}&exclude=minutely,daily,alerts&units=metric&appid=${apiKey}`;
      const res = await fetchImpl(url);
      if (!res.ok) throw new Error(`OpenWeather ${res.status}`);
      const body = (await res.json()) as { timezone_offset: number; hourly?: { dt: number; temp: number; pop: number; weather?: { description: string }[] }[] };
      return (body.hourly ?? [])
        .map((h) => ({ local: new Date((h.dt + body.timezone_offset) * 1000), h }))
        .filter(({ local }) => local.toISOString().slice(0, 10) === date)
        .map(({ local, h }) => ({ hour: local.getUTCHours(), tempC: Math.round(h.temp), rainChance: Math.round(h.pop * 100), summary: h.weather?.[0]?.description ?? '' }));
    },
  };
}

/** Tavily search, for "what's famous to eat here" grounding. */
export function tavily(apiKey: string, fetchImpl: typeof fetch = fetch): SearchProvider {
  return {
    async search(query) {
      const res = await fetchImpl('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ query, search_depth: 'basic', max_results: 5 }),
      });
      if (!res.ok) throw new Error(`Tavily ${res.status}`);
      const body = (await res.json()) as { results?: { title: string; url: string; content: string }[] };
      return (body.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.content.slice(0, 400) }));
    },
  };
}
