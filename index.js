
const http = require("http");

const PORT = process.env.PORT || 3000;
const MAX_API = "https://platform-api2.max.ru";

// Главное меню
const mainKeyboard = {
  type: "inline_keyboard",
  payload: {
    buttons: [
      [{ type: "callback", text: "🏠 Советы по умному дому", payload: "tips" }],
      [{ type: "callback", text: "📚 Статьи и обзоры", payload: "articles" }],
      [{ type: "callback", text: "💰 Расчёты и экономия", payload: "calculations" }],
      [{ type: "callback", text: "🌐 Сайт проекта", payload: "website" }],
      [{ type: "callback", text: "🤝 Сотрудничество", payload: "cooperation" }]
    ]
  }
};

// Кнопка возврата
const homeKeyboard = {
  type: "inline_keyboard",
  payload: {
    buttons: [
      [{ type: "callback", text: "🏠 Главное меню", payload: "menu" }]
    ]
  }
};

// Тексты разделов
const pages = {
  tips: {
    text: "🏠 СОВЕТЫ ПО УМНОМУ ДОМУ\n\nРазбираемся, как сделать дом удобнее с помощью технологий.\n\nВ этом разделе:\n• Умное освещение и розетки\n• Датчики и автоматизация\n• Zigbee, Wi-Fi и Matter\n• Практические советы по настройке\n\nВыбирайте нужный раздел в главном меню."
  },

  articles: {
    text: "📚 СТАТЬИ И ОБЗОРЫ\n\nВ Дзене публикуем подробные материалы:\n\n• Обзоры умных устройств\n• Сравнения моделей и цен\n• Расчёты реальной экономии\n• Практические инструкции\n\nПереходите в наш канал «Технологии в быту»!"
  },

  calculations: {
    text: "💰 РАСЧЁТЫ И ЭКОНОМИЯ\n\nПоможем разобраться, сколько действительно стоят технологии для дома.\n\nЗдесь будут:\n• Расчёт расходов на умный дом\n• Экономия электроэнергии\n• Сравнение стоимости устройств\n• Оценка окупаемости покупок\n\nСчитаем реальные деньги, а не рекламные обещания."
  },

  website: {
    text: "🌐 САЙТ ПРОЕКТА\n\nНаш сайт пока находится в разработке.\n\nСкоро здесь появится информация о проекте «Умный быт 5.0», полезные материалы и дополнительные возможности.\n\nА пока оставайтесь с нами в MAX и Дзене!"
  },

  cooperation: {
    text: "🤝 СОТРУДНИЧЕСТВО\n\nОткрыты к сотрудничеству с производителями, магазинами и авторами полезных проектов.\n\nВозможные форматы:\n• Рекламные публикации\n• Обзоры устройств\n• Партнёрские материалы\n• Совместные проекты\n\nНапишите нам в MAX с предложением о сотрудничестве."
  }
};

// Запрос к MAX API
async function maxRequest(path, method, data) {
  const response = await fetch(MAX_API + path, {
    method,
    headers: {
      Authorization: process.env.MAX_BOT_TOKEN,
      "Content-Type": "application/json"
    },
    body: data ? JSON.stringify(data) : undefined
  });

  const result = await response.text();

  if (!response.ok) {
    throw new Error(`MAX API ${response.status}: ${result}`);
  }

  return result;
}

// Отправка главного меню
async function sendMainMenu(userId) {
  return maxRequest(
    `/messages?user_id=${encodeURIComponent(userId)}`,
    "POST",
    {
      text: "Привет! 👋\n\nЯ бот проекта «Умный быт 5.0».\n\nПомогу разобраться в технологиях для дома, выбрать устройства и оценить реальную экономию.\n\nВыберите интересующий раздел:",
      attachments: [mainKeyboard]
    }
  );
}

// Ответ на нажатие кнопки
async function answerCallback(callbackId, payload) {
  let message;

  if (payload === "menu") {
    message = {
      text: "🏠 ГЛАВНОЕ МЕНЮ\n\nВыберите интересующий раздел:",
      attachments: [mainKeyboard]
    };
  } else if (payload === "articles") {
    message = {
      text: pages.articles.text,
      attachments: [
        {
          type: "inline_keyboard",
          payload: {
            buttons: [
              [{
                type: "link",
                text: "Открыть Дзен",
                url: "https://dzen.ru/tech50"
              }],
              [{
                type: "callback",
                text: "🏠 Главное меню",
                payload: "menu"
              }]
            ]
          }
        }
      ]
    };
  } else if (pages[payload]) {
    message = {
      text: pages[payload].text,
      attachments: [homeKeyboard]
    };
  } else {
    message = {
      text: "Не удалось определить раздел. Вернёмся в главное меню.",
      attachments: [mainKeyboard]
    };
  }

  return maxRequest(
    `/answers?callback_id=${encodeURIComponent(callbackId)}`,
    "POST",
    { message }
  );
}

// HTTP-сервер
const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const path = req.url.split("?")[0];

  // Приём событий из Cloudflare Queue
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

      console.log("Incoming MAX update:", {
        update_type: update.update_type || "unknown",
        chat_id: update.chat_id || null,
        timestamp: update.timestamp || null
      });

      // Нажатие кнопки
      if (update.update_type === "message_callback") {
        const callbackId = update.callback?.callback_id;
        const payload = update.callback?.payload;

        if (!callbackId) {
          throw new Error("Callback ID is missing");
        }

        await answerCallback(callbackId, payload);

        console.log("MAX button answered:", payload || "unknown");
      }

      // Обычное сообщение пользователя
else if (update.update_type === "message_created") {
  const sender = update.message?.sender;
  console.log("Incoming message body:", JSON.stringify(update.message?.body));
const text = update.message?.text?.trim() || "";

  if (sender?.user_id && sender.is_bot !== true) {
    if (/^привет\b/i.test(text)) {
      await sendMainMenu(sender.user_id);
      console.log("MAX welcome menu sent");
    } else {
      await maxRequest(
        `/messages?user_id=${encodeURIComponent(sender.user_id)}`,
        "POST",
        {
          text: "Пока я понимаю только команды из меню 😊\n\nВыберите нужный раздел с помощью кнопок ниже 👇",
          attachments: [mainKeyboard]
        }
      );
      console.log("MAX unsupported message response sent");
    }
  }
}

      // Запуск бота
      else if (update.update_type === "bot_started") {
        const userId = update.user?.user_id;

        if (userId) {
          await sendMainMenu(userId);
          console.log("MAX welcome menu sent");
        }
      }

      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));

    } catch (error) {
      console.error("Update processing error:", error.message);
      res.writeHead(502);
      res.end(JSON.stringify({ error: "Update processing failed" }));
    }

    return;
  }

  // Регистрация Webhook
  if (req.method === "GET" && path === "/register-webhook") {
    try {
      if (!process.env.MAX_BOT_TOKEN || !process.env.MAX_WEBHOOK_SECRET) {
        throw new Error("MAX token or webhook secret is missing");
      }

      const result = await maxRequest("/subscriptions", "POST", {
        url: "https://max-smart-home-bot.vladislav116117.workers.dev/webhook",
        update_types: [
          "message_created",
          "bot_started",
          "message_callback"
        ],
        secret: process.env.MAX_WEBHOOK_SECRET
      });

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, result }));

    } catch (error) {
      console.error("Webhook registration error:", error.message);
      res.writeHead(502);
      res.end(JSON.stringify({ error: error.message }));
    }

    return;
  }

  // Проверка подписок
  if (req.method === "GET" && path === "/check-subscriptions") {
    try {
      const result = await maxRequest("/subscriptions", "GET");
      res.writeHead(200);
      res.end(result);
    } catch (error) {
      res.writeHead(502);
      res.end(JSON.stringify({ error: error.message }));
    }

    return;
  }

  // Проверка бота
  if (req.method === "GET" && path === "/check-me") {
    try {
      const result = await maxRequest("/me", "GET");
      res.writeHead(200);
      res.end(result);
    } catch (error) {
      res.writeHead(502);
      res.end(JSON.stringify({ error: error.message }));
    }

    return;
  }

  // Проверка сервера
  if (req.method === "GET" && path === "/") {
    res.writeHead(200);
    res.end(JSON.stringify({ status: "online" }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server started on port ${PORT}`);
});
