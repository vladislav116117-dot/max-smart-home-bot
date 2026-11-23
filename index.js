
const http = require("http");

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

    if (req.method === "GET" && req.url.split("?")[0] === "/check-subscriptions") {
    const token = process.env.MAX_BOT_TOKEN;

    if (!token) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: "MAX_BOT_TOKEN is missing" }));
      return;
    }

    try {
      const response = await fetch("https://platform-api2.max.ru/subscriptions", {
        method: "GET",
        headers: {
          Authorization: token
        }
      });

      const body = await response.text();

      res.writeHead(response.status);
      res.end(body);
    } catch (error) {
      res.writeHead(502);
      res.end(JSON.stringify({
        error: "MAX subscriptions check failed",
        details: error.message
      }));
    }

    return;
  }
  
 if (req.url === "/") {
    res.writeHead(200);
    res.end(JSON.stringify({ status: "online" }));
    return;
  }

  if (req.url === "/check-me") {
    const token = process.env.MAX_BOT_TOKEN;

    if (!token) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: "MAX_BOT_TOKEN is missing" }));
      return;
    }

    try {
      const response = await fetch("https://platform-api2.max.ru/me", {
        method: "GET",
        headers: {
          Authorization: token
        }
      });

      const body = await response.text();

      res.writeHead(response.status);
      res.end(body);
    } catch (error) {
      res.writeHead(502);
      res.end(JSON.stringify({
        error: "MAX API connection failed",
        details: error.message
      }));
    }

    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server started on port ${PORT}`);
});
