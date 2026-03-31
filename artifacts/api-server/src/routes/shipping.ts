import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const PROVINCES_SHIPPING: Record<string, { cost: number; days: number; description: string }> = {
  "Buenos Aires": { cost: 3500, days: 3, description: "Entrega en 3 días hábiles" },
  "CABA": { cost: 2500, days: 2, description: "Entrega en 2 días hábiles" },
  "Catamarca": { cost: 2800, days: 2, description: "Entrega en 2 días hábiles — sucursal local" },
  "Chaco": { cost: 5200, days: 5, description: "Entrega en 5 días hábiles" },
  "Chubut": { cost: 6500, days: 7, description: "Entrega en 7 días hábiles" },
  "Córdoba": { cost: 3800, days: 3, description: "Entrega en 3 días hábiles" },
  "Corrientes": { cost: 4800, days: 5, description: "Entrega en 5 días hábiles" },
  "Entre Ríos": { cost: 4200, days: 4, description: "Entrega en 4 días hábiles" },
  "Formosa": { cost: 5500, days: 6, description: "Entrega en 6 días hábiles" },
  "Jujuy": { cost: 4500, days: 4, description: "Entrega en 4 días hábiles" },
  "La Pampa": { cost: 4800, days: 5, description: "Entrega en 5 días hábiles" },
  "La Rioja": { cost: 3800, days: 3, description: "Entrega en 3 días hábiles" },
  "Mendoza": { cost: 4500, days: 4, description: "Entrega en 4 días hábiles" },
  "Misiones": { cost: 5200, days: 5, description: "Entrega en 5 días hábiles" },
  "Neuquén": { cost: 5800, days: 6, description: "Entrega en 6 días hábiles" },
  "Río Negro": { cost: 5800, days: 6, description: "Entrega en 6 días hábiles" },
  "Salta": { cost: 4200, days: 4, description: "Entrega en 4 días hábiles" },
  "San Juan": { cost: 4500, days: 4, description: "Entrega en 4 días hábiles" },
  "San Luis": { cost: 4200, days: 4, description: "Entrega en 4 días hábiles" },
  "Santa Cruz": { cost: 7500, days: 8, description: "Entrega en 8 días hábiles" },
  "Santa Fe": { cost: 3800, days: 3, description: "Entrega en 3 días hábiles" },
  "Santiago del Estero": { cost: 3500, days: 3, description: "Entrega en 3 días hábiles" },
  "Tierra del Fuego": { cost: 8500, days: 10, description: "Entrega en 10 días hábiles" },
  "Tucumán": { cost: 4000, days: 4, description: "Entrega en 4 días hábiles" },
};

async function shippingCostHandler(req: Request, res: Response) {
  const { province } = req.query as Record<string, string>;

  if (!province) {
    res.status(400).json({ error: "missing_province", message: "Province is required" });
    return;
  }

  const shipping = PROVINCES_SHIPPING[province];

  if (!shipping) {
    res.status(400).json({ error: "invalid_province", message: `Province "${province}" not found` });
    return;
  }

  res.json({
    province,
    cost: shipping.cost,
    days: shipping.days,
    description: shipping.description,
  });
}

router.get("/shipping/cost", shippingCostHandler);
router.get("/shipping-cost", shippingCostHandler);

router.get("/shipping/provinces", async (_req, res) => {
  res.json({ provinces: Object.keys(PROVINCES_SHIPPING).sort() });
});

export default router;
