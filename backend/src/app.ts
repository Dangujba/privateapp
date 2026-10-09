import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import type { BlockchainTransaction, PaymentIntent, Prisma, User } from '@prisma/client';
import { config } from './config.js';
import { prisma } from './db.js';
import { audit } from './lib/audit.js';
import { clearSession, getRefreshToken, hashToken, issueSession, randomToken, requireAuth, requireRole } from './lib/auth.js';
import { findConfirmedPayment } from './lib/chain.js';
import { ApiError, asyncHandler, errorHandler, serialize } from './lib/http.js';
import { koboToNaira, koboToNanoton, nairaToKobo } from './lib/money.js';
import { bocHash, encodePayRevenuePayload, normaliseTonAddress } from './lib/ton.js';
import { verifyTonProof } from './lib/ton-proof.js';
import type { AuthRequest, AuthUser, Role } from './types.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", config.FRONTEND_ORIGIN, 'https://*.ton.org', 'https://*.tonapi.io', 'https://*.toncenter.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
}));
app.use(cors({ origin: config.FRONTEND_ORIGIN, credentials: true }));
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());

const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });
const paymentLimiter = rateLimit({ windowMs: 60_000, limit: 40, standardHeaders: 'draft-8', legacyHeaders: false });

const publicUser = (user: { id: string; email: string; firstName: string; lastName: string; phone: string | null; role: string; emailVerifiedAt: Date | null }) => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  phone: user.phone,
  role: user.role,
  emailVerified: Boolean(user.emailVerifiedAt),
});

const authUser = (user: { id: string; email: string; role: string }): AuthUser => ({ id: user.id, email: user.email, role: user.role as Role });
const normaliseEmail = (email: string) => email.trim().toLowerCase();
const normaliseTin = (tin: string) => tin.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

type PaymentForDto = PaymentIntent & { blockchainTransaction?: BlockchainTransaction | null; user?: Pick<User, 'firstName' | 'lastName' | 'email'> | null };
function paymentDto(payment: PaymentForDto) {
  return {
    ...serialize(payment),
    amountNgn: Number(koboToNaira(BigInt(payment.amountKobo))),
    amountTon: Number(BigInt(payment.amountNanoton)) / 1e9,
    txHash: payment.blockchainTransaction?.transactionHash ?? null,
    payer: payment.user ? { name: `${payment.user.firstName} ${payment.user.lastName}`, email: payment.user.email } : undefined,
  };
}

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'yirs-revenue-system-api', network: config.TON_NETWORK }));
app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok', service: 'yirs-revenue-system-api', network: config.TON_NETWORK }));

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(5).max(128),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(30).optional(),
  role: z.enum(['individual', 'business']),
  tin: z.string().min(6).max(30),
  businessName: z.string().trim().min(2).max(160).optional(),
  category: z.string().trim().max(80).optional(),
});

app.post('/api/v1/auth/register', authLimiter, asyncHandler(async (req, res) => {
  const input = registerSchema.parse(req.body);
  if (input.role === 'business' && !input.businessName) throw new ApiError(400, 'Business name is required');
  const email = normaliseEmail(input.email);
  const tin = normaliseTin(input.tin);
  const passwordHash = await bcrypt.hash(input.password, 12);
  const verificationToken = randomToken();
  const user = await prisma.$transaction(async tx => {
    const created = await tx.user.create({ data: { email, passwordHash, firstName: input.firstName, lastName: input.lastName, phone: input.phone, role: input.role } });
    if (input.role === 'individual') {
      await tx.taxpayerProfile.create({ data: { userId: created.id, tin, fullName: `${input.firstName} ${input.lastName}` } });
    } else {
      await tx.businessProfile.create({ data: { userId: created.id, tin, businessName: input.businessName!, category: input.category ?? 'other' } });
    }
    await tx.accountToken.create({ data: { userId: created.id, kind: 'verify_email', tokenHash: hashToken(verificationToken), expiresAt: new Date(Date.now() + 24 * 60 * 60_000) } });
    return created;
  });
  const tokens = await issueSession(res, authUser(user));
  await audit(req, 'auth.register', 'user', user.id, { role: user.role });
  res.status(201).json({ user: publicUser(user), tokens, ...(config.NODE_ENV === 'development' ? { verificationToken } : {}) });
}));

app.post('/api/v1/auth/login', authLimiter, asyncHandler(async (req, res) => {
  const input = z.object({ email: z.email(), password: z.string().min(1).max(128) }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: normaliseEmail(input.email) } });
  if (!user || !user.isActive || !(await bcrypt.compare(input.password, user.passwordHash))) throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  const tokens = await issueSession(res, authUser(user));
  await audit(req, 'auth.login', 'user', user.id);
  res.json({ user: publicUser(user), tokens });
}));

app.post('/api/v1/auth/refresh', authLimiter, asyncHandler(async (req: AuthRequest, res) => {
  const refreshToken = getRefreshToken(req);
  if (!refreshToken) throw new ApiError(401, 'Refresh token is required');
  let claims: jwt.JwtPayload;
  try {
    const value = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET, { audience: config.APP_DOMAIN, issuer: 'yirs-revenue-system-api' });
    if (typeof value === 'string' || value.type !== 'refresh' || !value.sub) throw new Error('Invalid claims');
    claims = value;
  } catch { throw new ApiError(401, 'Refresh token is invalid or expired'); }
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) }, include: { user: true } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date() || !stored.user.isActive || stored.userId !== claims.sub) throw new ApiError(401, 'Refresh token is invalid or expired');
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  const tokens = await issueSession(res, authUser(stored.user));
  res.json({ user: publicUser(stored.user), tokens });
}));

app.post('/api/v1/auth/logout', asyncHandler(async (req: AuthRequest, res) => {
  const refreshToken = getRefreshToken(req);
  if (refreshToken) await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
  clearSession(res);
  res.status(204).send();
}));

app.get('/api/v1/auth/me', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.id }, include: { taxpayerProfile: true, businessProfile: true, wallets: true } });
  if (!user) throw new ApiError(404, 'User not found');
  res.json({ user: publicUser(user), taxpayerProfile: user.taxpayerProfile, businessProfile: user.businessProfile, wallets: user.wallets });
}));

app.post('/api/v1/auth/verify-email', authLimiter, asyncHandler(async (req, res) => {
  const { token } = z.object({ token: z.string().min(20) }).parse(req.body);
  const record = await prisma.accountToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.kind !== 'verify_email' || record.usedAt || record.expiresAt < new Date()) throw new ApiError(400, 'Verification token is invalid or expired');
  await prisma.$transaction([
    prisma.accountToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
  ]);
  res.json({ message: 'Email verified' });
}));

app.post('/api/v1/auth/password/forgot', authLimiter, asyncHandler(async (req, res) => {
  const { email } = z.object({ email: z.email() }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: normaliseEmail(email) } });
  let resetToken: string | undefined;
  if (user) {
    resetToken = randomToken();
    await prisma.accountToken.create({ data: { userId: user.id, kind: 'reset_password', tokenHash: hashToken(resetToken), expiresAt: new Date(Date.now() + 60 * 60_000) } });
  }
  res.status(202).json({ message: 'If that account exists, reset instructions have been generated', ...(config.NODE_ENV === 'development' && resetToken ? { resetToken } : {}) });
}));

app.post('/api/v1/auth/password/reset', authLimiter, asyncHandler(async (req, res) => {
  const { token, password } = z.object({ token: z.string().min(20), password: z.string().min(5).max(128) }).parse(req.body);
  const record = await prisma.accountToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.kind !== 'reset_password' || record.usedAt || record.expiresAt < new Date()) throw new ApiError(400, 'Reset token is invalid or expired');
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.accountToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  res.json({ message: 'Password reset complete' });
}));

app.post('/api/v1/auth/wallet/challenge', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const nonce = randomToken();
  await prisma.walletChallenge.create({ data: { userId: req.auth!.id, nonceHash: hashToken(nonce), expiresAt: new Date(Date.now() + 15 * 60_000) } });
  res.json({ payload: nonce, expiresIn: 900 });
}));

app.post('/api/v1/auth/wallet/verify', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const input = z.object({
    address: z.string(), walletStateInit: z.string().min(1), network: z.string(),
    proof: z.object({ timestamp: z.number().int(), domain: z.object({ lengthBytes: z.number().int(), value: z.string() }), payload: z.string(), signature: z.string() }),
  }).parse(req.body);
  const challenge = await prisma.walletChallenge.findUnique({ where: { nonceHash: hashToken(input.proof.payload) } });
  if (!challenge || challenge.userId !== req.auth!.id || challenge.usedAt || challenge.expiresAt < new Date()) throw new ApiError(400, 'Wallet challenge is invalid or expired');
  const verified = await verifyTonProof(input, input.proof.payload);
  await prisma.$transaction([
    prisma.walletChallenge.update({ where: { id: challenge.id }, data: { usedAt: new Date() } }),
    prisma.verifiedWallet.upsert({ where: { address: verified.address }, update: { userId: req.auth!.id, network: input.network, publicKey: verified.publicKey, walletStateInit: input.walletStateInit, proofVerifiedAt: new Date() }, create: { userId: req.auth!.id, address: verified.address, network: input.network, publicKey: verified.publicKey, walletStateInit: input.walletStateInit, proofVerifiedAt: new Date() } }),
  ]);
  await audit(req, 'wallet.verify', 'wallet', verified.address);
  res.json({ verified: true, address: verified.address });
}));

app.post('/api/v1/taxpayers/register', requireAuth, requireRole('individual'), asyncHandler(async (req: AuthRequest, res) => {
  const input = z.object({ tin: z.string().min(6), fullName: z.string().min(2), address: z.string().optional() }).parse(req.body);
  const profile = await prisma.taxpayerProfile.upsert({ where: { userId: req.auth!.id }, update: { fullName: input.fullName, address: input.address }, create: { userId: req.auth!.id, tin: normaliseTin(input.tin), fullName: input.fullName, address: input.address } });
  res.status(201).json({ profile });
}));

app.get('/api/v1/taxpayers/profile', requireAuth, requireRole('individual'), asyncHandler(async (req: AuthRequest, res) => {
  const profile = await prisma.taxpayerProfile.findUnique({ where: { userId: req.auth!.id } });
  if (!profile) throw new ApiError(404, 'Taxpayer profile not found');
  const payments = await prisma.paymentIntent.findMany({ where: { userId: req.auth!.id } });
  const confirmed = payments.filter(p => p.status === 'confirmed');
  res.json({ profile, stats: { totalPaid: Number(koboToNaira(confirmed.reduce((sum, p) => sum + p.amountKobo, 0n))), pendingPayments: payments.filter(p => ['created', 'wallet_pending', 'submitted', 'onchain_pending'].includes(p.status)).length, lastPaymentDate: confirmed.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]?.confirmedAt ?? null, complianceStatus: profile.complianceStatus } });
}));

app.put('/api/v1/taxpayers/profile', requireAuth, requireRole('individual'), asyncHandler(async (req: AuthRequest, res) => {
  const input = z.object({ fullName: z.string().min(2).optional(), address: z.string().max(250).optional() }).parse(req.body);
  const profile = await prisma.taxpayerProfile.update({ where: { userId: req.auth!.id }, data: input });
  await audit(req, 'taxpayer.update', 'taxpayer_profile', profile.id);
  res.json({ profile });
}));

app.post('/api/v1/businesses/register', requireAuth, requireRole('business'), asyncHandler(async (req: AuthRequest, res) => {
  const input = z.object({ tin: z.string().min(6), businessName: z.string().min(2), category: z.string().min(2), address: z.string().optional() }).parse(req.body);
  const profile = await prisma.businessProfile.upsert({ where: { userId: req.auth!.id }, update: { businessName: input.businessName, category: input.category, address: input.address }, create: { userId: req.auth!.id, tin: normaliseTin(input.tin), businessName: input.businessName, category: input.category, address: input.address } });
  res.status(201).json({ profile });
}));

app.get('/api/v1/businesses/profile', requireAuth, requireRole('business'), asyncHandler(async (req: AuthRequest, res) => {
  const profile = await prisma.businessProfile.findUnique({ where: { userId: req.auth!.id } });
  if (!profile) throw new ApiError(404, 'Business profile not found');
  const payments = await prisma.paymentIntent.findMany({ where: { userId: req.auth!.id }, orderBy: { createdAt: 'desc' } });
  const confirmed = payments.filter(p => p.status === 'confirmed');
  res.json({ profile, stats: { totalPayments: payments.length, confirmedPayments: confirmed.length, totalPaidNgn: Number(koboToNaira(confirmed.reduce((sum, p) => sum + p.amountKobo, 0n))), pendingPayments: payments.filter(p => ['created', 'wallet_pending', 'submitted', 'onchain_pending'].includes(p.status)).length, lastPaymentDate: confirmed[0]?.confirmedAt ?? null } });
}));

app.put('/api/v1/businesses/profile', requireAuth, requireRole('business'), asyncHandler(async (req: AuthRequest, res) => {
  const input = z.object({ businessName: z.string().min(2).max(120).optional(), category: z.string().min(2).max(80).optional(), address: z.string().max(250).optional() }).refine(value => Object.keys(value).length > 0, 'At least one field is required').parse(req.body);
  const profile = await prisma.businessProfile.update({ where: { userId: req.auth!.id }, data: input });
  await audit(req, 'business.update', 'business_profile', profile.id, input);
  res.json({ profile });
}));

async function currentRate() {
  const stored = await prisma.exchangeRate.findFirst({ where: { active: true }, orderBy: { observedAt: 'desc' } });
  if (stored) return stored;
  return prisma.exchangeRate.create({ data: { tonNgnKobo: nairaToKobo(config.TON_EXCHANGE_RATE_NGN), source: 'configured-development-rate', observedAt: new Date() } });
}

app.post('/api/v1/payments/calculate', paymentLimiter, asyncHandler(async (req, res) => {
  const input = z.object({ amountNgn: z.union([z.string(), z.number()]) }).parse(req.body);
  const amountKobo = nairaToKobo(input.amountNgn);
  if (amountKobo < 10_000n) throw new ApiError(400, 'Minimum amount is ₦100.00');
  const rate = await currentRate();
  const amountNanoton = koboToNanoton(amountKobo, rate.tonNgnKobo);
  res.json({ calculation: { amountNgn: Number(koboToNaira(amountKobo)), exchangeRate: Number(koboToNaira(rate.tonNgnKobo)), exchangeRateSource: rate.source, exchangeRateTimestamp: rate.observedAt, amountTon: Number(amountNanoton) / 1e9, amountNanoton: amountNanoton.toString() } });
}));

app.post('/api/v1/payments/initiate', paymentLimiter, requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  if (!config.TON_CONTRACT_ADDRESS) throw new ApiError(503, 'TON_CONTRACT_ADDRESS is not configured');
  const input = z.object({ amountNgn: z.union([z.string(), z.number()]), taxType: z.string().min(2).max(100), taxPeriod: z.string().max(50).optional(), description: z.string().max(240).optional(), senderAddress: z.string(), referenceId: z.string().max(80).optional() }).parse(req.body);
  const senderAddress = normaliseTonAddress(input.senderAddress);
  const wallet = await prisma.verifiedWallet.findFirst({ where: { userId: req.auth!.id, address: senderAddress, network: config.TON_NETWORK === 'testnet' ? '-3' : '-239' } });
  if (!wallet) throw new ApiError(403, 'Connect and verify this wallet with TON Proof before paying', 'WALLET_NOT_VERIFIED');
  const idempotencyKey = req.get('idempotency-key') ?? nanoid(32);
  const existing = await prisma.paymentIntent.findUnique({ where: { idempotencyKey } });
  if (existing) return res.json({ transaction: paymentDto(existing), payment: { contractAddress: config.TON_CONTRACT_ADDRESS, amountNanoton: (existing.amountNanoton + existing.gasNanoton).toString(), payload: existing.payloadBoc, network: config.TON_NETWORK } });
  const amountKobo = nairaToKobo(input.amountNgn);
  if (amountKobo < 10_000n) throw new ApiError(400, 'Minimum amount is ₦100.00');
  const rate = await currentRate();
  if (Date.now() - rate.observedAt.getTime() > 60 * 60_000) throw new ApiError(503, 'Exchange rate is stale; ask an administrator to refresh it');
  const referenceId = input.referenceId ?? `YIRS-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${nanoid(10).toUpperCase()}`;
  const validUntil = Math.floor(Date.now() / 1000) + 10 * 60;
  const user = await prisma.user.findUnique({ where: { id: req.auth!.id }, include: { taxpayerProfile: true, businessProfile: true } });
  const taxpayerId = user?.taxpayerProfile?.tin ?? user?.businessProfile?.tin ?? req.auth!.id;
  const payloadBoc = encodePayRevenuePayload({ referenceId, taxpayerId, taxType: input.taxType, amountKobo, exchangeRateKobo: rate.tonNgnKobo, validUntil, description: input.description ?? '' });
  const amountNanoton = koboToNanoton(amountKobo, rate.tonNgnKobo);
  const payment = await prisma.paymentIntent.create({ data: { referenceId, idempotencyKey, transactionNumber: `YIRS-${Date.now()}-${nanoid(6).toUpperCase()}`, userId: req.auth!.id, senderAddress, taxType: input.taxType, taxPeriod: input.taxPeriod, description: input.description, amountKobo, exchangeRateKobo: rate.tonNgnKobo, exchangeRateSource: rate.source, exchangeRateTimestamp: rate.observedAt, amountNanoton, gasNanoton: config.PAYMENT_GAS_NANOTON, payloadBoc, payloadHash: createHash('sha256').update(payloadBoc).digest('hex'), status: 'wallet_pending', expiresAt: new Date(validUntil * 1000) } });
  await audit(req, 'payment.initiate', 'payment_intent', payment.id, { referenceId, taxType: input.taxType });
  res.status(201).json({ transaction: paymentDto(payment), payment: { contractAddress: normaliseTonAddress(config.TON_CONTRACT_ADDRESS), amountNanoton: (amountNanoton + config.PAYMENT_GAS_NANOTON).toString(), payload: payloadBoc, network: config.TON_NETWORK, validUntil } });
}));

app.post('/api/v1/payments/:id/confirm', paymentLimiter, requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const { boc } = z.object({ boc: z.string().min(16) }).parse(req.body);
  const payment = await prisma.paymentIntent.findFirst({ where: { id: String(req.params.id), userId: req.auth!.id } });
  if (!payment) throw new ApiError(404, 'Payment not found');
  if (payment.expiresAt < new Date()) {
    await prisma.paymentIntent.update({ where: { id: payment.id }, data: { status: 'expired' } });
    throw new ApiError(409, 'Payment intent has expired');
  }
  if (payment.status === 'confirmed') return res.json({ status: 'confirmed', payment: paymentDto(payment) });
  const walletBocHash = bocHash(boc);
  const updated = await prisma.paymentIntent.update({ where: { id: payment.id }, data: { walletBocHash, status: 'onchain_pending', submittedAt: new Date() } });
  await audit(req, 'payment.submitted', 'payment_intent', payment.id, { walletBocHash });
  res.status(202).json({ status: updated.status, message: 'Wallet submission received. The backend is independently checking the on-chain transaction.' });
}));

app.post('/api/v1/payments/:id/verify', paymentLimiter, requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const where: Prisma.PaymentIntentWhereInput = req.auth!.role === 'admin' || req.auth!.role === 'super_admin' ? { id: String(req.params.id) } : { id: String(req.params.id), userId: req.auth!.id };
  const payment = await prisma.paymentIntent.findFirst({ where });
  if (!payment) throw new ApiError(404, 'Payment not found');
  if (!['submitted', 'onchain_pending'].includes(payment.status)) return res.json({ status: payment.status, payment: paymentDto(payment) });
  const chain = await findConfirmedPayment(payment);
  if (!chain) return res.status(202).json({ status: 'onchain_pending', message: 'Transaction is not yet confirmed on-chain' });
  const snapshot = { referenceId: payment.referenceId, transactionNumber: payment.transactionNumber, taxType: payment.taxType, taxPeriod: payment.taxPeriod, amountKobo: payment.amountKobo.toString(), senderAddress: payment.senderAddress, transactionHash: chain.transactionHash, confirmedAt: chain.timestamp.toISOString() };
  const confirmed = await prisma.$transaction(async tx => {
    await tx.blockchainTransaction.create({ data: { paymentIntentId: payment.id, transactionHash: chain.transactionHash, logicalTime: chain.logicalTime, sender: chain.sender, recipient: chain.recipient, valueNanoton: chain.valueNanoton, decodedPayload: JSON.stringify(snapshot), success: true, timestamp: chain.timestamp, networkFeeNanoton: chain.networkFeeNanoton, confirmations: 1, raw: chain.raw } });
    await tx.paymentReceipt.create({ data: { paymentIntentId: payment.id, receiptNumber: `RCP-${Date.now()}-${nanoid(6).toUpperCase()}`, snapshot: JSON.stringify(snapshot) } });
    return tx.paymentIntent.update({ where: { id: payment.id }, data: { status: 'confirmed', confirmedAt: new Date() }, include: { blockchainTransaction: true, receipt: true } });
  });
  await audit(req, 'payment.confirmed', 'payment_intent', payment.id, { transactionHash: chain.transactionHash });
  res.json({ status: 'confirmed', payment: paymentDto(confirmed) });
}));

app.get('/api/v1/payments', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const page = Math.max(1, Number(req.query.page) || 1); const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : undefined;
  const where = { userId: req.auth!.id, ...(status ? { status } : {}) };
  const [items, total] = await Promise.all([prisma.paymentIntent.findMany({ where, include: { blockchainTransaction: true, receipt: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }), prisma.paymentIntent.count({ where })]);
  res.json({ payments: items.map(paymentDto), transactions: items.map(paymentDto), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

app.get('/api/v1/payments/:id', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const payment = await prisma.paymentIntent.findFirst({ where: { id: String(req.params.id), userId: req.auth!.id }, include: { blockchainTransaction: true, receipt: true } });
  if (!payment) throw new ApiError(404, 'Payment not found');
  res.json({ payment: paymentDto(payment) });
}));

app.get('/api/v1/payments/:id/receipt', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const payment = await prisma.paymentIntent.findFirst({ where: { id: String(req.params.id), userId: req.auth!.id, status: 'confirmed' }, include: { blockchainTransaction: true, receipt: true } });
  if (!payment?.receipt) throw new ApiError(404, 'Confirmed receipt not found');
  res.json({ receipt: { ...payment.receipt, payment: paymentDto(payment), snapshot: JSON.parse(payment.receipt.snapshot) } });
}));

const admin = [requireAuth, requireRole('admin', 'super_admin')] as const;

app.get('/api/v1/admin/dashboard', ...admin, asyncHandler(async (_req, res) => {
  const [users, individuals, businesses, payments, confirmed, pending, today, rate] = await Promise.all([
    prisma.user.count(), prisma.user.count({ where: { role: 'individual' } }), prisma.user.count({ where: { role: 'business' } }), prisma.paymentIntent.count(), prisma.paymentIntent.findMany({ where: { status: 'confirmed' } }), prisma.paymentIntent.count({ where: { status: { in: ['created', 'wallet_pending', 'submitted', 'onchain_pending'] } } }), prisma.paymentIntent.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }), currentRate(),
  ]);
  const revenueKobo = confirmed.reduce((sum, p) => sum + p.amountKobo, 0n);
  const todayKobo = confirmed.filter(p => p.confirmedAt && p.confirmedAt >= new Date(new Date().setHours(0, 0, 0, 0))).reduce((sum, p) => sum + p.amountKobo, 0n);
  const dashboard = { revenue: { totalNgn: Number(koboToNaira(revenueKobo)), todayNgn: Number(koboToNaira(todayKobo)) }, users: { total: users, totalIndividuals: individuals, totalBusinesses: businesses }, transactions: { total: payments, pending, today }, blockchain: { contractAddress: config.TON_CONTRACT_ADDRESS || null, contractBalance: null, totalCollected: null, isPaused: null, status: config.TON_CONTRACT_ADDRESS ? 'configured' : 'not_deployed' }, exchangeRate: { tonNgn: Number(koboToNaira(rate.tonNgnKobo)), source: rate.source, timestamp: rate.observedAt } };
  res.json({ ...dashboard, dashboard });
}));

app.get('/api/v1/admin/transactions', ...admin, asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1); const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20)); const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : undefined;
  const where = status ? { status } : {}; const [items, total] = await Promise.all([prisma.paymentIntent.findMany({ where, include: { user: true, blockchainTransaction: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }), prisma.paymentIntent.count({ where })]);
  res.json({ transactions: items.map(paymentDto), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

app.get('/api/v1/admin/taxpayers', ...admin, asyncHandler(async (_req, res) => {
  const profiles = await prisma.taxpayerProfile.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' } });
  res.json({ taxpayers: profiles.map(p => ({ ...p, user: publicUser(p.user), email: p.user.email, full_name: p.fullName, compliance_status: p.complianceStatus, tin_verified: p.verified })) });
}));

app.put('/api/v1/admin/taxpayers/:id/verify', ...admin, asyncHandler(async (req, res) => {
  const input = z.object({ verified: z.boolean(), complianceStatus: z.enum(['pending', 'compliant', 'non_compliant']).optional() }).parse(req.body);
  const profile = await prisma.taxpayerProfile.update({ where: { id: String(req.params.id) }, data: { verified: input.verified, complianceStatus: input.complianceStatus ?? (input.verified ? 'compliant' : 'pending') } });
  await audit(req, 'admin.taxpayer.verify', 'taxpayer_profile', profile.id, input); res.json({ profile });
}));

app.get('/api/v1/admin/businesses', ...admin, asyncHandler(async (_req, res) => {
  const profiles = await prisma.businessProfile.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' } });
  res.json({ businesses: profiles.map(p => ({ ...p, user: publicUser(p.user), email: p.user.email, business_name: p.businessName, compliance_status: p.complianceStatus, is_verified: p.verified })) });
}));

app.put('/api/v1/admin/businesses/:id/verify', ...admin, asyncHandler(async (req, res) => {
  const input = z.object({ verified: z.boolean(), complianceStatus: z.enum(['pending', 'compliant', 'non_compliant']).optional() }).parse(req.body);
  const profile = await prisma.businessProfile.update({ where: { id: String(req.params.id) }, data: { verified: input.verified, complianceStatus: input.complianceStatus ?? (input.verified ? 'compliant' : 'pending') } });
  await audit(req, 'admin.business.verify', 'business_profile', profile.id, input); res.json({ profile });
}));

app.get('/api/v1/admin/reports/revenue', ...admin, asyncHandler(async (req, res) => {
  const year = Math.min(2100, Math.max(2000, Number(req.query.year) || new Date().getUTCFullYear())); const period = req.query.period === 'daily' ? 'daily' : 'monthly';
  const payments = await prisma.paymentIntent.findMany({ where: { status: 'confirmed', confirmedAt: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } } });
  const buckets = new Map<string, { totalRevenueKobo: bigint; totalNanoton: bigint; transactionCount: number }>();
  for (const p of payments) { const date = p.confirmedAt!; const key = period === 'daily' ? date.toISOString().slice(0, 10) : date.toISOString().slice(0, 7); const value = buckets.get(key) ?? { totalRevenueKobo: 0n, totalNanoton: 0n, transactionCount: 0 }; value.totalRevenueKobo += p.amountKobo; value.totalNanoton += p.amountNanoton; value.transactionCount++; buckets.set(key, value); }
  const data = [...buckets.entries()].sort().map(([label, value]) => ({ label, period: label.length === 7 ? `${label}-01` : label, totalRevenueNgn: Number(koboToNaira(value.totalRevenueKobo)), totalTon: Number(value.totalNanoton) / 1e9, transactionCount: value.transactionCount }));
  const report = { period, year, data };
  res.json({ ...report, report });
}));

app.get('/api/v1/admin/audit-logs', ...admin, asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1); const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const [logs, total] = await Promise.all([prisma.auditLog.findMany({ include: { actor: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }), prisma.auditLog.count()]);
  const mapped = logs.map(log => ({ ...log, actor: log.actor ? publicUser(log.actor) : null, metadata: log.metadata ? JSON.parse(log.metadata) : null, created_at: log.createdAt, user_email: log.actor?.email ?? null, resource_type: log.entityType, ip_address: log.ipAddress, success: true }));
  res.json({ logs: mapped, auditLogs: mapped, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

app.get('/api/v1/admin/settings', ...admin, asyncHandler(async (_req, res) => {
  const rows = await prisma.systemSetting.findMany({ where: { sensitive: false } });
  const settings = Object.fromEntries(rows.map(row => [row.key, row.value]));
  res.json({ settings: { receivingWallet: settings.receivingWallet ?? config.GOVERNMENT_WALLET_ADDRESS, tonNetwork: config.TON_NETWORK, contractAddress: config.TON_CONTRACT_ADDRESS, collectorAddress: config.TON_CONTRACT_ADDRESS, contractVersion: '3.0.0', exchangeRateSource: (await currentRate()).source } });
}));

app.put('/api/v1/admin/settings/wallet', ...admin, asyncHandler(async (req, res) => {
  const { walletAddress } = z.object({ walletAddress: z.string() }).parse(req.body); const address = normaliseTonAddress(walletAddress);
  await prisma.systemSetting.upsert({ where: { key: 'receivingWallet' }, update: { value: address }, create: { key: 'receivingWallet', value: address } });
  await audit(req, 'admin.wallet.update', 'system_setting', 'receivingWallet'); res.json({ walletAddress: address });
}));

app.post('/api/v1/admin/settings/exchange-rate', ...admin, asyncHandler(async (req, res) => {
  const input = z.object({ tonNgn: z.union([z.string(), z.number()]), source: z.string().min(2).max(100) }).parse(req.body); const value = nairaToKobo(input.tonNgn);
  const previous = await currentRate(); const difference = value > previous.tonNgnKobo ? value - previous.tonNgnKobo : previous.tonNgnKobo - value;
  if (difference * 100n > previous.tonNgnKobo * 20n) throw new ApiError(400, 'Exchange-rate change exceeds the 20% safety limit');
  await prisma.exchangeRate.updateMany({ where: { active: true }, data: { active: false } }); const rate = await prisma.exchangeRate.create({ data: { tonNgnKobo: value, source: input.source, observedAt: new Date() } });
  await audit(req, 'admin.exchange_rate.update', 'exchange_rate', rate.id); res.json({ rate: { tonNgn: Number(koboToNaira(rate.tonNgnKobo)), source: rate.source, timestamp: rate.observedAt } });
}));

app.get('/api/v1/admin/contracts', ...admin, asyncHandler(async (_req, res) => res.json({ contracts: await prisma.smartContractDeployment.findMany({ orderBy: { createdAt: 'desc' } }) })));
app.post('/api/v1/admin/contracts/deploy', ...admin, asyncHandler(async (req, res) => {
  const input = z.object({ contractType: z.enum(['RevenueCollector']), initialParams: z.record(z.string(), z.unknown()) }).parse(req.body);
  const deployment = await prisma.smartContractDeployment.create({ data: { contractType: input.contractType, network: config.TON_NETWORK, initialParams: JSON.stringify(input.initialParams), status: 'prepared' } });
  await audit(req, 'admin.contract.prepare', 'smart_contract_deployment', deployment.id);
  res.status(201).json({ deployment, message: 'Deployment record prepared. Sign and broadcast the deployment using the contracts deploy script.' });
}));

app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found' } }));
app.use(errorHandler);

export { app };
