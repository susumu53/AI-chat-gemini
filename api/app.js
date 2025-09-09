const chat = document.getElementById("chat");
const form = document.getElementById("form");
const input = document.getElementById("input");

function addMsg(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.innerHTML = `
    <div class="name">${role === "user" ? "あなた" : "AI"}</div>
    <div class="bubble">${text}</div>
  `;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div.querySelector(".bubble");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const prompt = input.value.trim();
  if (!prompt) return;

  // ユーザー発言を表示
  addMsg("user", prompt);

  // AIのバブルを用意（中身を少しずつ増やす）
  const bubble = addMsg("bot", ""); 

  // 入力UIロック
  input.value = "";
  input.disabled = true;
  form.querySelector("button").disabled = true;

  try {
    // サーバーへPOST（SSEをfetchで受信）
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: prompt }),
    });

    if (!res.ok || !res.body) {
      bubble.textContent = "エラーが発生しました。しばらくしてからお試しください。";
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE区切りでパース（\n\nごとにイベント）
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const evt of events) {
        // "data: {...}" の行を探す
        const lines = evt.split("\n").filter(Boolean);
        const dataLine = lines.find(l => l.startsWith("data:"));
        if (!dataLine) continue;

        try {
          const payload = JSON.parse(dataLine.replace(/^data:\s*/, ""));
          if (payload?.text) {
            // 受け取ったテキストを追記
            bubble.textContent += payload.text;
            chat.scrollTop = chat.scrollHeight;
          }
        } catch { /* JSONでない行は無視 */ }
      }
    }
  } catch (err) {
    console.error(err);
    bubble.textContent = "接続に失敗しました。";
  } finally {
    input.disabled = false;
    form.querySelector("button").disabled = false;
    input.focus();
  }
});
