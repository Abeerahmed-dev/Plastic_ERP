import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { verifyRole } from '../../middleware/requireRole';
import {
  getCategoriesHandler,
  getCategoryByIdHandler,
  createCategoryHandler,
  updateCategoryHandler,
  deleteCategoryHandler,
} from './categories.controller';

const router = Router();

router.use(requireAuth);

router.get('/', getCategoriesHandler);
router.get('/:id', getCategoryByIdHandler);
router.post('/', verifyRole(['ADMIN', 'OWNER', 'CASHIER']), createCategoryHandler);
router.put('/:id', verifyRole(['ADMIN', 'OWNER']), updateCategoryHandler);
router.delete('/:id', verifyRole(['ADMIN', 'OWNER']), deleteCategoryHandler);

export default router;
