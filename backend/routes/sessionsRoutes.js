import express from 'express';
const router = express.Router();

import { openSalonSession, closeSalonSession, getSalonSession } from '../controllers/sessionsController.js';
import { requireRole } from '../middleware/auth.js';


router.post('/', requireRole('owner', 'manager', 'cashier'), openSalonSession);

router.put('/', requireRole('owner', 'manager'), closeSalonSession);

router.get('/', requireRole('owner', 'manager', 'cashier'), getSalonSession)

export default router;
