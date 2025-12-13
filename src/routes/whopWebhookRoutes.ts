import express from 'express';
import { handleAppInstall } from '../controllers/whopWebhookController.js';

const router = express.Router();

router.post('/app-install', handleAppInstall);

export default router;
