
exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed." })
    };
  }

  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid request." })
    };
  }

  if (["name", "email", "address"].some(
    key => typeof data[key] !== "string" || !data[key].trim()
  )) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: "Please complete your name, email, and property address."
      })
    };
  }

  if (/[\r\n]/.test(data.email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Please enter a valid email address." })
    };
  }

  if (!Array.isArray(data.services) || data.services.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Please select at least one service." })
    };
  }

  const gmailUser = process.env.GMAIL_USER;
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!gmailUser || !clientId || !clientSecret || !refreshToken) {
    console.error("Gmail environment variables are missing.");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Email service is not configured yet." })
    };
  }

  const safe = value =>
    String(value ?? "").replace(/[<>]/g, "").slice(0, 1000);

  const money = value => "$" + Number(value || 0).toFixed(2);

  const serviceRows = data.services.map(service =>
    `${safe(service.label)}: ${safe(service.amount)} ${safe(service.unit)} × ${money(service.rate)} = ${money(service.subtotal)}`
  ).join("\n");

  const emailBody = [
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
    // Exchange the refresh token for a short-lived access token.
    const tokenResponse = await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token"
        })
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Google token error:", tokenData.error || "Unknown error");
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          error: "Could not authorize the email service. Please try again later."
        })
      };
    }

    const subject = `Pressure washing quote - ${safe(data.name)} - ${money(data.quoteTotal)}`;

    const mimeMessage = [
      `From: ${gmailUser}`,
      "To: careers@finchharbor.com",
      `Reply-To: ${data.email}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(emailBody, "utf8").toString("base64")
    ].join("\r\n");

    const rawMessage = Buffer.from(mimeMessage, "utf8").toString("base64url");

    const sendResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ raw: rawMessage })
      }
    );

    if (!sendResponse.ok) {
      const detail = await sendResponse.text();
      console.error("Gmail send error:", sendResponse.status, detail);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          error: "Email could not be sent right now. Please try again later."
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true })
    };
  } catch (error) {
    console.error("Email service error:", error.message);
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({
        error: "Email service temporarily unavailable."
      })
    };
  }
};
