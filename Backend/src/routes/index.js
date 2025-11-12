const express = require('express');

const authRouter = require('./auth');
const auditsRouter = require('./audits');
const notificationsRouter = require('./notifications');
const meetingsRouter = require('./meetings');
const complianceRouter = require('./compliance');
const dashboardRouter = require('./dashboard');

const router = express.Router();

router.use('/auth', authRouter);
router.use('/audits', auditsRouter);
router.use('/notifications', notificationsRouter);
router.use('/meetings', meetingsRouter);
router.use('/compliance', complianceRouter);
router.use('/dashboard', dashboardRouter);

module.exports = router;
