import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { reviewsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/products/:id/reviews", async (req, res) => {
  try {
    const productId = parseInt(req.params.id, 10);
    if (isNaN(productId)) {
      res.status(400).json({ error: "invalid_id", message: "Invalid product ID" });
      return;
    }

    const reviews = await db
      .select()
      .from(reviewsTable)
      .where(eq(reviewsTable.productId, productId))
      .orderBy(desc(reviewsTable.createdAt));

    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    res.json({ reviews, total: reviews.length, avgRating: Math.round(avgRating * 10) / 10 });
  } catch (err) {
    req.log.error({ err }, "Error fetching reviews");
    res.status(500).json({ error: "internal_error", message: "Error fetching reviews" });
  }
});

router.post("/products/:id/reviews", async (req, res) => {
  try {
    const productId = parseInt(req.params.id, 10);
    if (isNaN(productId)) {
      res.status(400).json({ error: "invalid_id", message: "Invalid product ID" });
      return;
    }

    const { authorName, rating, comment } = req.body as {
      authorName?: string;
      rating?: number;
      comment?: string;
    };

    if (!authorName || !rating || !comment) {
      res.status(400).json({ error: "invalid_request", message: "Todos los campos son requeridos" });
      return;
    }

    if (rating < 1 || rating > 5) {
      res.status(400).json({ error: "invalid_rating", message: "El rating debe ser entre 1 y 5" });
      return;
    }

    const [review] = await db.insert(reviewsTable).values({
      productId,
      authorName: authorName.trim(),
      rating: Math.round(rating),
      comment: comment.trim(),
    }).returning();

    res.status(201).json(review);
  } catch (err) {
    req.log.error({ err }, "Error creating review");
    res.status(500).json({ error: "internal_error", message: "Error creating review" });
  }
});

export default router;
