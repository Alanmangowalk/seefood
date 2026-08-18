export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      try {
        const counts = await env.DB.prepare(`
          SELECT
            (SELECT COUNT(*) FROM users) AS users,
            (SELECT COUNT(*) FROM shops) AS shops,
            (SELECT COUNT(*) FROM shop_items) AS shop_items,
            (SELECT COUNT(*) FROM orders) AS orders,
            (SELECT COUNT(*) FROM payments) AS payments,
            (SELECT COUNT(*) FROM tickets) AS tickets
        `).first();

        return Response.json({
          status: "ok",
          service: "SEEFOOD",
          database: "seefood-staging",
          d1: "connected",
          counts
        });
      } catch (error) {
        return Response.json(
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

    if (url.pathname.startsWith("/api/")) {
      return Response.json(
        { status: "error", message: "API route not found" },
        { status: 404 }
      );
    }

    return env.ASSETS.fetch(request);
  }
};
