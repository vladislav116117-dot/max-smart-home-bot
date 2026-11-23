
const http = require("http");

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const path = req.url.split("?")[0];

  // Приём и обработка входящего события
  if (req.method === "POST" && path === "/process-update") {
    const secret = req.headers["x-queue-forward-secret"];

    if (
      !process.env.QUEUE_FORWARD_SECRET ||
      secret !== process.env.QUEUE_FORWARD_SECRET
    ) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    try {
      let body = "";

      for await (const chunk of req) {
        body += chunk;

        if (body.length > 1024 * 1024) {
          res.writeHead(413);
          res.end(JSON.stringify({ error: "Payload too large" }));
          return;
        }
      }

      const update = JSON.parse(body);

      if (!update || typeof update !== "object") {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "Invalid update" }));
        return;
      }

      console.log("Incoming MAX update:", {
        update_type: update.update_type || "unknown",
        chat_id: update.chat_id || null,
        timestamp: update.timestamp || null
      });

      // Отвечаем на обычное сообщение пользователя
      if (
        update.update_type === "message_created" &&
        update.message?.sender?.user_id &&
        update.message.sender.is_bot !== true
      ) {
        const userId = update.message.sender.user_id;

        const maxResponse = await fetch(
          `https://platform-api2.max.ru/messages?user_id=${userId}`,
          {
            method: "POST",
            headers: {
              "Authorization": process.env.MAX_BOT_TOKEN,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              text: "Привет! 👋 Я бот канала «Умный быт 5.0».\n\nПомогу разобраться с умными устройствами и технологиями для дома. Скоро здесь появится меню с полезными разделами!"
            })
          }
        );

        const result = await maxResponse.text();

        if (!maxResponse.ok) {
          console.error("MAX send error:", maxResponse.status, result);
          res.writeHead(502);
          res.end(JSON.stringify({ error: "MAX message send failed" }));
          return;
        }

        console.log("MAX reply sent to user:", userId);
      }

      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));

    } catch (error) {
      console.error("Update processing error:", error.message);

      res.writeHead(400);
      res.end(JSON.stringify({ error: error.message }));
    }

    return;
  }

  // Однократная регистрация Webhook MAX
  if (req.method === "GET" && path === "/register-webhook") {
    try {
      const response = await fetch(
        "https://platform-api2.max.ru/subscriptions",
        {
          method: "POST",
          headers: {
            "Authorization": process.env.MAX_BOT_TOKEN,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            url: "https://max-smart-home-bot.vladislav116117.workers.dev/webhook",
            update_types: ["message_created", "bot_started", "message_callback"],
            secret: process.env.MAX_WEBHOOK_SECRET
          })
        }
      );

      const result = await response.text();

      res.writeHead(response.status);
      res.end(result);
    } catch (error) {
      res.writeHead(502);
      res.end(JSON.stringify({ error: error.message }));
    }

    return;
  }

  // Проверка подписок MAX
  if (req.method === "GET" && path === "/check-subscriptions") {
    const token = process.env.MAX_BOT_TOKEN;

    if (!token) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: "MAX_BOT_TOKEN is missing" }));
      return;
    }

    try {
      const response = await fetch(
        "https://platform-api2.max.ru/subscriptions",
        {
          method: "GET",
          headers: { Authorization: token }
        }
      );

      const body = await response.text();

      res.writeHead(response.status);
      res.end(body);
    } catch (error) {
      res.writeHead(502);
      res.end(JSON.stringify({ error: error.message }));
    }

    return;
  }

  // Проверка доступности сервера
  if (req.method === "GET" && path === "/") {
    res.writeHead(200);
    res.end(JSON.stringify({ status: "online" }));
    return;
  }

  // Проверка соединения с MAX API
  if (req.method === "GET" && path === "/check-me") {
    const token = process.env.MAX_BOT_TOKEN;

    if (!token) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: "MAX_BOT_TOKEN is missing" }));
      return;
    }

    try {
      const response = await fetch(
        "https://platform-api2.max.ru/me",
        {
          method: "GET",
          headers: { Authorization: token }
        }
      );

      const body = await response.text();

      res.writeHead(response.status);
      res.end(body);
    } catch (error) {
      res.writeHead(502);
      res.end(JSON.stringify({ error: error.message }));
    }

    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server started on port ${PORT}`);
});
