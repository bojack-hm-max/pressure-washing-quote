exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed." }) };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: "Email service is not configured yet." }) };

  let data;
  try { data = JSON.parse(event.body || "{}"); } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid request." }) };
  }
  const required = ["name", "email", "address"];
  if (required.some(k => typeof data[k] !== "string" || !data[k].trim())) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Please complete your name, email, and property address." }) };
  }
  if (!Array.isArray(data.services) || data.services.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Please select at least one service." }) };
  }
  const safe = v => String(v ?? "").replace(/[<>]/g, "").slice(0, 1000);
  const money = n => "$" + Number(n || 0).toFixed(2);
  const serviceRows = data.services.map(s =>
    `${safe(s.label)}: ${safe(s.amount)} ${safe(s.unit)} × ${money(s.rate)} = ${money(s.subtotal)}`
  ).join("\n");
  const body = [
    "New pressure washing quote request",
    "",
    `Name: ${safe(data.name)}`,
    `Email: ${safe(data.email)}`,
    `Phone: ${safe(data.phone || "Not provided")}`,
    `Property address: ${safe(data.address)}`,
    "",
    "Requested services:",
    serviceRows,
    "",
    `Calculated subtotal: ${money(data.rawTotal)}`,
    `Minimum job price applied: ${data.minimumApplied ? "Yes" : "No"}`,
    `ESTIMATED QUOTE: ${money(data.quoteTotal)}`,
    "",
    `Additional notes: ${safe(data.notes || "None")}`
  ].join("\n");

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Pressure Washing Quotes <onboarding@resend.dev>",
        to: ["careers@finchharbor.com"],
        reply_to: data.email,
        subject: `Pressure washing quote — ${safe(data.name)} — ${money(data.quoteTotal)}`,
        text: body
      })
    });
    if (!resp.ok) {
      const detail = await resp.text();
      console.error("Email provider error:", resp.status, detail);
      return { statusCode: 502, headers, body: JSON.stringify({ error: "Email could not be sent right now. Please try again later." }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 502, headers, body: JSON.stringify({ error: "Email service temporarily unavailable." }) };
  }
};
