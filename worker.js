export default {
  async fetch(request, env) {

    if (request.method !== "POST") {
      return new Response("فقط POST اجازه داره!", { status: 405 });
    }


    const update = await request.json();
    console.log("داده‌های ارسالی از تلگرام:", JSON.stringify(update));


    if (!update.message) {
      console.log("آپدیت message نداره، رد می‌کنم.");
      return new Response("آپدیت بدون پیام", { status: 200 });
    }

    const message = update.message;
    if (!message.text) {
      console.log("پیام text نداره:", JSON.stringify(message));
      return new Response("پیام بدون متن", { status: 200 });
    }

    const chatId = message.chat.id;
    const userText = message.text;
    const chatType = message.chat.type;
    const botUsername = "rombot"; // نام کاربری ربات
    const botName = "رومولی"; // اسم ربات


    let isRelevantMessage = false;


    if (chatType === "private") {
      isRelevantMessage = true;
      console.log("چت خصوصی، پیام مرتبط است.");
    }

    else if (chatType === "group" || chatType === "supergroup") {
      const textLower = userText.toLowerCase();
      const botUsernameLower = botUsername.toLowerCase();


      if (textLower.includes(botName) || textLower.includes(`@${botUsernameLower}`)) {
        isRelevantMessage = true;
        console.log("اسم ربات توی پیام بود، پیام مرتبط است.");
      }


      if (message.reply_to_message) {
        const repliedMessage = message.reply_to_message;
        const repliedFrom = repliedMessage.from || {};
        const repliedUsername = repliedFrom.username || "";
        const repliedId = repliedFrom.id;
        const botId = env.BOT_ID;

        if (repliedUsername === botUsername || (botId && repliedId == botId)) {
          isRelevantMessage = true;
          console.log("ریپلای روی پیام ربات بود، پیام مرتبط است.");
        }
      }

      if (!isRelevantMessage) {
        console.log("پیام به ربات مربوط نیست، رد می‌کنم:", userText);
        return new Response("پیام غیرمرتبط", { status: 200 });
      }
    }


    let shouldReply = false;
    let replyToMessageId = null;

    if (chatType === "private") {
      shouldReply = true;
      console.log("چت خصوصی، باید جواب بدم.");
    } else if (chatType === "group" || chatType === "supergroup") {
      console.log("چت گروهی، چک می‌کنم که صدام کرده باشن...");


      if (message.reply_to_message) {
        const repliedMessage = message.reply_to_message;
        console.log("ریپلای روی پیام:", JSON.stringify(repliedMessage));

        const repliedFrom = repliedMessage.from || {};
        const repliedUsername = repliedFrom.username || "";
        const repliedId = repliedFrom.id;

        const botId = env.BOT_ID;
        if (repliedUsername === botUsername || (botId && repliedId == botId)) {
          shouldReply = true;
          replyToMessageId = message.message_id;
          console.log("ریپلای روی پیام من بود، باید جواب بدم! message_id:", message.message_id);
        } else {
          console.log("ریپلای روی پیام من نبود.");
        }
      }


      if (!shouldReply) {
        const textLower = userText.toLowerCase();
        const botUsernameLower = botUsername.toLowerCase();
        console.log("متن پیام (به حروف کوچک):", textLower);
        console.log("چک کردن اسم ربات:", botName, `@${botUsernameLower}`);

        if (textLower.includes(botName) || textLower.includes(`@${botUsernameLower}`)) {
          shouldReply = true;
          replyToMessageId = message.message_id;
          console.log("اسمم رو صدا زدن، باید جواب بدم! message_id:", message.message_id);
        } else {
          console.log("اسمم رو صدا نزدن.");
        }
      }
    }


    if (!shouldReply) {
      console.log("نباید جواب بدم:", userText);
      return new Response("منو صدا نکردن!", { status: 200 });
    }


    const textLowerForName = userText.toLowerCase();
    const isAskingAboutName = textLowerForName.includes("اسمت") || textLowerForName.includes("اسم تو") || textLowerForName.includes("کی هستی") || textLowerForName.includes("چه کسی هستی");
    console.log("آیا درباره اسم پرسیده؟:", isAskingAboutName);

    // پرامپت برای Gemini
    let promptText;
    if (isAskingAboutName) {
promptText = `به این جمله یا سوال جواب کوتاه و طنز بده مثل یک رفیق بامزه باش و اول پیام بگو من رومولی هستم تاکید میکنم جواب کوتاه بده ، جمله یا سوال : "${userText}"`;
    } else {
      promptText = `یه جواب کوتاه و طنز به فارسی بده به این پیام، مثل یه دوست صمیمی حرف بزن، بدون توضیح یا سؤالم: "${userText}"`;
    }


    const geminiApiKey = env.GEMINI_API_KEY;
    const geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + geminiApiKey;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: promptText,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 100,
        },
      }),
    });

    const geminiData = await geminiResponse.json();
    if (!geminiData.candidates || !geminiData.candidates[0]?.content?.parts?.[0]?.text) {
      console.log("خطا در پاسخ Gemini:", JSON.stringify(geminiData));
      return new Response("خطا در Gemini", { status: 500 });
    }

    const replyText = geminiData.candidates[0].content.parts[0].text;

    // ارسال جواب به تلگرام
    const telegramUrl = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`;
    
    let telegramPayload = {
      chat_id: chatId,
      text: replyText,
    };

    if (replyToMessageId) {
      telegramPayload.reply_to_message_id = replyToMessageId;
    }

    console.log("ارسال پیام به تلگرام:", JSON.stringify(telegramPayload));

    let telegramResponse = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(telegramPayload),
    });

    if (!telegramResponse.ok) {
      const errorText = await telegramResponse.text();
      console.log("خطا در ارسال به تلگرام (تلاش اول):", errorText);

      if (errorText.includes("message to be replied not found")) {
        console.log("خطای ریپلای، دوباره بدون ریپلای امتحان می‌کنم...");
        telegramPayload = {
          chat_id: chatId,
          text: replyText,
        };
        telegramResponse = await fetch(telegramUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(telegramPayload),
        });
      }
    }

    if (!telegramResponse.ok) {
      console.log("خطا در ارسال به تلگرام (تلاش نهایی):", await telegramResponse.text());
      return new Response("خطا در ارسال به تلگرام", { status: 500 });
    }

    console.log("پیام با موفقیت ارسال شد!");
    return new Response("OK", { status: 200 });
  },
};
