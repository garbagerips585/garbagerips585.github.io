// GET /api/latest
//
// YouTube's RSS feed sends no Access-Control-Allow-Origin header, so the browser
// cannot read it directly. This proxies it, tags each entry with the same
// taxonomy the sync script uses, and hands back JSON.
//
// Purpose is freshness only: data/videos.json holds the full back catalogue,
// and this layers the newest uploads on top so a rip posted an hour ago still
// shows without re-running the sync. The site works fine if this 502s.

import { deriveTags } from "../../shared/taxonomy.mjs";
import { ripPath } from "../../shared/paths.mjs";

const FEED = "https://www.youtube.com/feeds/videos.xml?channel_id=UCnpEGJ2G_0af1YRyW2euIZQ";

function decode(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function parse(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => {
    const pick = (re) => {
      const m = re.exec(e);
      return m ? decode(m[1].trim()) : "";
    };
    const id = pick(/<yt:videoId>([\s\S]*?)<\/yt:videoId>/);
    const title = pick(/<title>([\s\S]*?)<\/title>/);
    const description = pick(/<media:description>([\s\S]*?)<\/media:description>/);
    const href = pick(/<link rel="alternate" href="([^"]+)"/);
    const views = Number((/<media:statistics views="(\d+)"/.exec(e) || [])[1] || 0);
    return {
      id,
      title,
      path: ripPath({ id, title }),
      published: pick(/<published>([\s\S]*?)<\/published>/).slice(0, 10),
      views,
      // The canonical link distinguishes a Short from a normal watch page, so
      // orientation comes free with no extra request.
      vertical: href.includes("/shorts/"),
      short: href.includes("/shorts/"),
      duration: 0,
      ...deriveTags({ title, description }),
    };
  }).filter((v) => v.id);
}

export async function onRequestGet({ request, waitUntil }) {
  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).origin + "/api/latest", { method: "GET" });

  // Workers run in front of the cache, so a Cache-Control header alone would
  // only reach the browser. Edge caching has to be done by hand.
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  let upstream;
  try {
    upstream = await fetch(FEED, { headers: { "User-Agent": "garbagerips585.com/1.0" } });
  } catch {
    return Response.json({ videos: [], error: "fetch-failed" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
  if (!upstream.ok) {
    return Response.json(
      { videos: [], error: "upstream", status: upstream.status },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }

  const videos = parse(await upstream.text());
  const res = Response.json(
    { videos, fetchedAt: new Date().toISOString() },
    {
      headers: {
        // YouTube itself sends max-age=900 on this feed, so half an hour at the
        // edge keeps us well inside their expectations.
        "Cache-Control": "public, max-age=300, s-maxage=1800",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
  waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
