import { Router } from 'express';
import { resetDatabaseController } from './dev.controller';

const devRouter = Router();

devRouter.post('/reset-database', resetDatabaseController);

export default devRouter;
