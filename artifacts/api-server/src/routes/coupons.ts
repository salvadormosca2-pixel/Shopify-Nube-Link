import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { couponsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

router.post("/coupons/validate", async (req, res) => {
  try {
    const { code } = req.body as { code?: string };

    if (!code) {
      res.status(400).json({ valid: false, discount: 0, message: "Código requerido" });
      return;
    }

    const [coupon] = await db
      .select()
      .from(couponsTable)
      .where(and(eq(couponsTable.code, code.toUpperCase().trim()), eq(couponsTable.active, true)))
      .limit(1);

    if (!coupon) {
      res.json({ valid: false, discount: 0, message: "Cupón inválido o inactivo" });
      return;
    }

    res.json({ valid: true, discount: coupon.discount, message: `Cupón aplicado: ${coupon.discount}% de descuento` });
  } catch (err) {
    req.log.error({ err }, "Error validating coupon");
    res.status(500).json({ valid: false, discount: 0, message: "Error al validar cupón" });
  }
});

export default router;
