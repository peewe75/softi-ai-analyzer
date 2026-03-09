import { RequestHandler, Router } from 'express';

export function createBillingRouter(authMiddleware: RequestHandler) {
  const router = Router();

  router.post('/checkout', authMiddleware, async (_req, res) => {
    res.status(501).json({
      error: 'Not Implemented',
      message: 'Stripe checkout is not enabled yet.'
    });
  });

  router.post('/webhook', async (req, res) => {
    console.log('Billing webhook stub received:', req.body);
    res.status(202).json({ accepted: true });
  });

  return router;
}
