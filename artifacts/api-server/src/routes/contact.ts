import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { contactMessagesTable } from "@workspace/db/schema";

const router: IRouter = Router();

router.post("/contact", async (req, res) => {
  try {
    const { name, email, message } = req.body as {
      name?: string;
      email?: string;
      message?: string;
    };

    if (!name || !email || !message) {
      res.status(400).json({ error: "invalid_request", message: "Todos los campos son requeridos" });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: "invalid_email", message: "Email inválido" });
      return;
    }

    await db.insert(contactMessagesTable).values({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      message: message.trim(),
    });

    res.status(201).json({ success: true, message: "Mensaje enviado correctamente" });
  } catch (err) {
    req.log.error({ err }, "Error saving contact message");
    res.status(500).json({ error: "internal_error", message: "Error al enviar el mensaje" });
  }
});

export default router;
