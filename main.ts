import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Stripe } from "https://esm.sh/stripe@12.0.0?target=deno";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

// Configuration
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const SMTP_USERNAME = Deno.env.get("SMTP_USERNAME") || "";
const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD") || "";

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

const smtpClient = new SmtpClient();

async function sendEmail(to: string) {
  await smtpClient.connectTLS({
    hostname: "smtp.gmail.com",
    port: 465,
    username: SMTP_USERNAME,
    password: SMTP_PASSWORD,
  });

  await smtpClient.send({
    from: SMTP_USERNAME,
    to: to,
    subject: "Accès à votre formation",
    content: `Bonjour,

Merci pour votre achat ! Voici le lien vers votre formation :
https://drive.google.com/drive/u/3/mobile/folders/1-4mJQWRZ6ZdEFn5IKlbZMWr7KP4CSbg1?usp=sharing_eip_se_dm&ts=6801a22d&pli=1

Cordialement,
L'équipe de formation`,
  });

  await smtpClient.close();
}

async function handleRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return new Response("No signature", { status: 400 });
    }

    const body = await request.text();
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      STRIPE_WEBHOOK_SECRET
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const customerEmail = session.customer_email;

      if (customerEmail) {
        await sendEmail(customerEmail);
        return new Response("Email sent successfully", { status: 200 });
      }
    }

    return new Response("Event processed", { status: 200 });
  } catch (err) {
    console.error("Error:", err);
    return new Response("Error processing webhook", { status: 400 });
  }
}

serve(handleRequest, { port: 8000 }); 