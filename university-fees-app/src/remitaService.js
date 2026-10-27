const crypto = require("crypto");

function configuration() {
  const merchantId = process.env.REMITA_MERCHANT_ID;
  const serviceTypeId = process.env.REMITA_SERVICE_TYPE_ID;
  const apiKey = process.env.REMITA_API_KEY;
  const baseUrl = (process.env.REMITA_BASE_URL || "https://remitademo.net").replace(/\/+$/, "");

  if (!merchantId || !serviceTypeId || !apiKey) {
    throw new Error("REMITA_MERCHANT_ID, REMITA_SERVICE_TYPE_ID and REMITA_API_KEY must be configured.");
  }

  return { merchantId, serviceTypeId, apiKey, baseUrl };
}

function hash(value) {
  return crypto.createHash("sha512").update(value).digest("hex");
}

async function remitaRequest(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Remita returned an unreadable response.");
  }

  if (!response.ok) {
    throw new Error(data.message || `Remita request failed with status ${response.status}.`);
  }
  return data;
}

async function generateRrr({ amountNaira, orderId, payerName, payerEmail, payerPhone, description }) {
  const { merchantId, serviceTypeId, apiKey, baseUrl } = configuration();
  const token = hash(`${merchantId}${serviceTypeId}${orderId}${amountNaira}${apiKey}`);
  const data = await remitaRequest(
    `${baseUrl}/remita/exapp/api/v1/send/api/echannelsvc/merchant/api/paymentinit`,
    {
      method: "POST",
      headers: {
        Authorization: `remitaConsumerKey=${merchantId},remitaConsumerToken=${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        serviceTypeId,
        amount: amountNaira,
        orderId,
        payerName,
        payerEmail,
        payerPhone: payerPhone || "",
        description,
      }),
    }
  );
  const rrr = String(data.RRR || data.rrr || "").trim();
  if (String(data.status || data.Status || "") !== "00" || !rrr) {
    throw new Error(data.message || data.Message || "Remita could not generate an RRR.");
  }

  return {
    rrr,
    paymentUrl: `${baseUrl}/remita/ecomm/finalize.reg?rrr=${encodeURIComponent(rrr)}&merchantId=${encodeURIComponent(merchantId)}`,
  };
}

async function verifyRrr(rrr) {
  const { merchantId, apiKey, baseUrl } = configuration();
  const token = hash(`${merchantId}${rrr}${apiKey}`);
  const data = await remitaRequest(
    `${baseUrl}/remita/exapp/api/v1/send/api/echannelsvc/${encodeURIComponent(merchantId)}/${encodeURIComponent(rrr)}/${token}/status.reg`,
    { headers: { Accept: "application/json" } }
  );
  const status = String(data.status || data.Status || "");
  return {
    status: status === "00" ? "success" : "pending",
    message: data.message || data.Message || "",
    channel: data.channel || data.paymentChannel || null,
    rrr: data.RRR || data.rrr || null,
    amountNaira: data.amount == null ? null : Number(data.amount),
  };
}

module.exports = { generateRrr, verifyRrr };
