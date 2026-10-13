import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import {
  listIncomingPdcsController,
  clearIncomingPdcController,
  bounceIncomingPdcController,
} from './incoming-pdcs.controller';

const router = Router();

router.use(requireAuth);

router.get('/', listIncomingPdcsController);
router.post('/:id/clear', clearIncomingPdcController);
router.post('/:id/bounce', bounceIncomingPdcController);

export default router;
