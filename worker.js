function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function taiwanDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatTaiwanShort(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  return `${get("month")}/${get("day")} ${get("hour")}:${get("minute")}`;
}

function bannerType(value) {
  const v = String(value || "").toUpperCase();
  if (v === "EXTERNAL") return "外部";
  if (v === "INTERNAL") return "內部";
  if (v === "PAGE") return "頁面";
  return value || "內部";
}

function contractStatusForLegacy(value) {
  return String(value || "").toUpperCase() === "SIGNED" ? "已完成" : "PENDING_REVIEW";
}

function consecutiveDays(daySet, now = new Date()) {
  let count = 0;
  const base = new Date(now);

  for (let i = 0; i < 14; i++) {
    const d = new Date(base.getTime() - i * 86400000);
    const key = taiwanDateKey(d);

    if (daySet.has(key)) {
      count++;
    } else if (i !== 0) {
      break;
    }
  }
  return count;
}

async function health(env) {
  const counts = await env.DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM shops) AS shops,
      (SELECT COUNT(*) FROM shop_items) AS shop_items,
      (SELECT COUNT(*) FROM orders) AS orders,
      (SELECT COUNT(*) FROM payments) AS payments,
      (SELECT COUNT(*) FROM tickets) AS tickets
  `).first();

  return {
    status: "ok",
    service: "SEEFOOD",
    database: "seefood-staging",
    d1: "connected",
    counts
  };
}

async function homeFeed(env) {
  const started = Date.now();
  const today = taiwanDateKey();

  const [
    summaryResult,
    merchantsResult,
    liveItemsResult,
    growthResult,
    orderDaysResult,
    bannersResult
  ] = await Promise.all([
    env.DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM shops) AS registered_stores,
        (SELECT COUNT(*) FROM orders) AS food_orders,
        (SELECT COUNT(*) FROM plus_subscriptions) AS plus_orders
    `).first(),

    env.DB.prepare(`
      SELECT
        s.shop_id,
        s.name,
        s.city,
        s.district,
        s.latitude,
        s.longitude,
        s.address,
        s.phone,
        s.created_at,
        COALESCE(bp.merchant_type, '公司/行號') AS merchant_type,
        CASE WHEN ps.shop_id IS NULL THEN 0 ELSE 1 END AS is_plus,
        COALESCE(mc.status, 'PENDING_REVIEW') AS contract_status
      FROM shops s
      LEFT JOIN shop_business_profiles bp
        ON bp.shop_id = s.shop_id
      LEFT JOIN (
        SELECT DISTINCT shop_id
        FROM plus_subscriptions
        WHERE status = 'ACTIVE'
          AND (ends_at IS NULL OR datetime(ends_at) > CURRENT_TIMESTAMP)
      ) ps
        ON ps.shop_id = s.shop_id
      LEFT JOIN (
        SELECT shop_id, status
        FROM merchant_contracts
        WHERE status = 'SIGNED'
        GROUP BY shop_id
      ) mc
        ON mc.shop_id = s.shop_id
      WHERE s.status = 'ACTIVE'
      ORDER BY s.created_at ASC, s.shop_id ASC
    `).all(),

    env.DB.prepare(`
      SELECT
        i.item_id,
        i.shop_id,
        i.slot_index,
        i.item_type,
        i.name AS item_name,
        i.description,
        i.original_price,
        i.sale_price,
        i.current_stock,
        i.pickup_cutoff,
        i.updated_at,
        s.name AS shop_name,
        s.city,
        s.district,
        s.address,
        s.phone,
        s.latitude,
        s.longitude,
        COALESCE(bp.merchant_type, '公司/行號') AS merchant_type,
        CASE WHEN ps.shop_id IS NULL THEN 0 ELSE 1 END AS is_plus,
        ses.opened_at,
        ses.auto_close_at
      FROM shop_items i
      JOIN shops s
        ON s.shop_id = i.shop_id
      JOIN item_sale_sessions ses
        ON ses.item_id = i.item_id
       AND ses.status = 'OPEN'
       AND datetime(ses.auto_close_at) > CURRENT_TIMESTAMP
      LEFT JOIN shop_business_profiles bp
        ON bp.shop_id = s.shop_id
      LEFT JOIN (
        SELECT DISTINCT shop_id
        FROM plus_subscriptions
        WHERE status = 'ACTIVE'
          AND (ends_at IS NULL OR datetime(ends_at) > CURRENT_TIMESTAMP)
      ) ps
        ON ps.shop_id = s.shop_id
      WHERE s.status = 'ACTIVE'
        AND i.status = 'ON'
        AND COALESCE(i.item_type, '') <> '暫不使用'
      ORDER BY s.shop_id ASC, i.slot_index ASC
    `).all(),

    env.DB.prepare(`
      SELECT
        s.shop_id,
        COALESCE(k.knock_today, 0) AS knock_today,
        COALESCE(w.watchers, 0) AS watchers
      FROM shops s
      LEFT JOIN (
        SELECT shop_id, COUNT(*) AS knock_today
        FROM knock_requests
        WHERE knock_date = ?
        GROUP BY shop_id
      ) k
        ON k.shop_id = s.shop_id
      LEFT JOIN (
        SELECT shop_id, COUNT(*) AS watchers
        FROM shop_watchlist
        WHERE status = 'ACTIVE'
        GROUP BY shop_id
      ) w
        ON w.shop_id = s.shop_id
      WHERE s.status = 'ACTIVE'
    `).bind(today).all(),

    env.DB.prepare(`
      SELECT DISTINCT
        shop_id,
        date(COALESCE(redeemed_at, paid_at, created_at), '+8 hours') AS sale_day
      FROM orders
      WHERE status IN ('PAID', 'REDEEMED')
    `).all(),

    env.DB.prepare(`
      SELECT
        image_url,
        title,
        subtitle,
        kicker,
        cta_text,
        link_type,
        link_target,
        sort_order
      FROM banners
      WHERE status = 'ACTIVE'
        AND (starts_at IS NULL OR datetime(starts_at) <= CURRENT_TIMESTAMP)
        AND (ends_at IS NULL OR datetime(ends_at) > CURRENT_TIMESTAMP)
      ORDER BY sort_order ASC, created_at ASC
    `).all()
  ]);

  const merchantsRows = merchantsResult.results || [];
  const liveRows = liveItemsResult.results || [];
  const growthRows = growthResult.results || [];
  const orderDayRows = orderDaysResult.results || [];
  const bannerRows = bannersResult.results || [];

  const growth = new Map();
  for (const row of growthRows) {
    growth.set(String(row.shop_id), {
      knockToday: Number(row.knock_today || 0),
      watchers: Number(row.watchers || 0)
    });
  }

  const orderDays = new Map();
  for (const row of orderDayRows) {
    const shopId = String(row.shop_id);
    if (!orderDays.has(shopId)) orderDays.set(shopId, new Set());
    if (row.sale_day) orderDays.get(shopId).add(String(row.sale_day));
  }

  const activeDistrictCounts = new Map();
  const activeShopDistrictSeen = new Set();
  for (const row of liveRows) {
    const shopId = String(row.shop_id);
    if (activeShopDistrictSeen.has(shopId)) continue;
    activeShopDistrictSeen.add(shopId);
    const district = row.district || "全部行政區";
    activeDistrictCounts.set(
      district,
      Number(activeDistrictCounts.get(district) || 0) + 1
    );
  }

  const intelligence = new Map();
  const stores = [];

  for (const row of liveRows) {
    const shopId = String(row.shop_id);
    const district = row.district || "全部行政區";
    const remain = Number(row.current_stock || 0);
    const streak = consecutiveDays(orderDays.get(shopId) || new Set());
    const tags = [];

    if (Number(activeDistrictCounts.get(district) || 0) === 1) {
      tags.push("🐺 本區孤勇者");
    }
    if (streak >= 2 && remain === 0) {
      tags.push(`🔥 連續完售${streak}天`);
    } else if (streak >= 1 && remain === 0) {
      tags.push("🔥 今日秒殺");
    }

    const lastOnline = formatTaiwanShort(row.updated_at || row.opened_at);

    stores.push({
      shopId,
      itemIndex: Number(row.slot_index || 0),
      name: row.shop_name || "未命名店鋪",
      time: row.pickup_cutoff || "",
      itemType: row.item_type || "",
      item: row.item_name || "",
      note: row.description || "",
      originalPrice: Number(row.original_price || 0),
      discountPrice: Number(row.sale_price || 0),
      remain,
      city: row.city || "全部地區",
      district,
      address: row.address || "",
      phone: row.phone || "",
      lat: Number(row.latitude || 0),
      lng: Number(row.longitude || 0),
      isVip: Boolean(row.is_plus),
      tags,
      streak,
      lastOnline
    });

    if (!intelligence.has(shopId)) {
      intelligence.set(shopId, {
        activeItems: 0,
        totalRemain: 0,
        lastOnline: "",
        tags: []
      });
    }
    const info = intelligence.get(shopId);
    info.activeItems++;
    info.totalRemain += remain;
    if (lastOnline && (!info.lastOnline || lastOnline > info.lastOnline)) {
      info.lastOnline = lastOnline;
    }
    for (const tag of tags) {
      if (!info.tags.includes(tag)) info.tags.push(tag);
    }
  }

  const allMerchants = merchantsRows.map((row) => {
    const shopId = String(row.shop_id);
    const isVip = Boolean(row.is_plus);
    const contractStatus = contractStatusForLegacy(row.contract_status);
    const verified = contractStatus === "已完成";
    const info = intelligence.get(shopId) || {
      activeItems: 0,
      totalRemain: 0,
      lastOnline: "",
      tags: []
    };
    const g = growth.get(shopId) || { knockToday: 0, watchers: 0 };

    return {
      shopId,
      name: row.name || "未命名店鋪",
      city: row.city || "全部地區",
      district: row.district || "全部行政區",
      lat: Number(row.latitude || 0),
      lng: Number(row.longitude || 0),
      address: row.address || "",
      phone: row.phone || "",
      merchantType: row.merchant_type || "公司/行號",
      isVip,
      contractStatus,
      verified,
      activeItems: info.activeItems,
      totalRemain: info.totalRemain,
      lastOnline: info.lastOnline,
      tags: info.tags,
      title: isVip ? "Plus 獵場" : (verified ? "實名獵場" : "新進獵場"),
      knockToday: g.knockToday,
      watchers: g.watchers
    };
  });

  const latestNews = allMerchants
    .slice()
    .reverse()
    .slice(0, 8)
    .map((m) => ({
      type: "NEW_SHOP",
      text: `${m.city || ""} ${m.district || ""}｜${m.name || "新獵場"} 加入 SEEFOOD`,
      shopId: m.shopId
    }));

  const banners = bannerRows.map((row) => ({
    imgUrl: row.image_url || "",
    title: row.title || "SEEFOOD 美食獵人",
    type: bannerType(row.link_type),
    link: row.link_target || "",
    subtitle: row.subtitle || "",
    cta: row.cta_text || "開始探索",
    kicker: row.kicker || "SEEFOOD 美食獵人",
    sort: Number(row.sort_order || 999)
  }));

  const registeredStores = Number(summaryResult?.registered_stores || 0);
  const legacyEquivalentOrderCount =
    Number(summaryResult?.food_orders || 0) +
    Number(summaryResult?.plus_orders || 0);

  return {
    status: "success",
    totalSavedKg: 1285.5 + legacyEquivalentOrderCount * 0.5,
    registeredStores,
    allMerchants,
    banners,
    stores,
    latestNews,
    _perf: {
      route: "HOME_FEED_D1",
      database: "seefood-staging",
      totalMs: Date.now() - started,
      stores: stores.length,
      merchants: allMerchants.length
    }
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      try {
        return json(await health(env));
      } catch (error) {
        return json(
          {
            status: "error",
            service: "SEEFOOD",
            database: "seefood-staging",
            d1: "connection_failed",
            message: error instanceof Error ? error.message : String(error)
          },
          { status: 500 }
        );
      }
    }

    if (url.pathname === "/api/home") {
      try {
        return json(await homeFeed(env));
      } catch (error) {
        return json(
          {
            status: "error",
            route: "HOME_FEED_D1",
            message: error instanceof Error ? error.message : String(error)
          },
          { status: 500 }
        );
      }
    }

    if (url.pathname.startsWith("/api/")) {
      return json(
        { status: "error", message: "API route not found" },
        { status: 404 }
      );
    }

    return env.ASSETS.fetch(request);
  }
};
