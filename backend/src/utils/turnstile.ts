import { Request, Response, NextFunction } from 'express';

/**
 * Optional Cloudflare Turnstile verification middleware.
 * When TURNSTILE_SECRET_KEY is configured, enforces a valid `turnstileToken` on public forms.
 * When unset (local dev or Turnstile not yet provisioned), passes through safely.
 */
export const verifyTurnstile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secretKey) {
    next();
    return;
  }

  const token = req.body?.turnstileToken;
  if (!token || typeof token !== 'string') {
    res.status(400).json({
      success: false,
      message: 'Please complete the human verification challenge.',
    });
    return;
  }

  try {
    const form = new URLSearchParams();
    form.set('secret', secretKey);
    form.set('response', token);
    if (req.ip) form.set('remoteip', req.ip);

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    const data = (await response.json()) as { success?: boolean };
    if (!data.success) {
      res.status(403).json({
        success: false,
        message: 'Human verification failed. Please retry the challenge.',
      });
      return;
    }

    next();
  } catch {
    res.status(503).json({
      success: false,
      message: 'Verification service temporarily unavailable.',
    });
  }
};
