import { Router } from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import contactRoutes from './contactRoutes.js';
import dealRoutes from './dealRoutes.js';
import dealTemplateRoutes from './dealTemplateRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import whopRoutes from './whopRoutes.js';
import whopProfileRoutes from './whopProfileRoutes.js';
import discordRoutes from './discordRoutes.js';
import leadRoutes from './leadRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/contacts', contactRoutes);
router.use('/deals', dealRoutes);
router.use('/deal-templates', dealTemplateRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/leads', leadRoutes);
router.use('/integrations/whop', whopRoutes);
router.use('/whop', whopProfileRoutes);
router.use('/integrations/discord', discordRoutes);

export default router;
