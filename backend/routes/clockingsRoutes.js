
import express from 'express';
const router = express.Router();

import { createClocking, updateClocking, getAllClocking, getActiveClockings } from '../controllers/clockingsController.js';

router.post('/', createClocking);

router.put('/', updateClocking);

router.get('/', getAllClocking);
router.get('/active', getActiveClockings);

export default router;

