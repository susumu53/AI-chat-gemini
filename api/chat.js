// api/chat.js
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: "message is required" });

  try {
    // SSEヘッダ
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    // ストリーミングで生成
    const streamResult = await model.generateContentStream({
      contents: [{ role: "user", parts: [{ text: message }]}],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 512
      }
    });

    for await (const chunk of streamResult.stream) {
      const text = chunk?.text?.();
      if (text) {
        // SSE: data: {"text":"..."}\n\n で順次送る
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    // 終了イベント
    res.write(`event: end\ndata: end\n\n`);
    res.end();
  } catch (e) {
    console.error(e);
    // エラーもSSEで通知（フロントで拾える）
    res.write(`event: error\ndata: ${JSON.stringify({ message: "server error" })}\n\n`);
    res.end();
  }
}
