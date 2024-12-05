/**
 * Security middleware for production-grade protection
 * Lightweight security headers and best practices
 * 
 * Security features (HTTPS enforcement, headers) are only active in staging and
 * production environments. Development mode prioritizes ease of debugging.
 * 
 * @module security
 */

import type { Express } from 'express';
import { config } from './config';

/**
 * Configure security headers and HTTPS enforcement
 * 
 * Headers configured:
 * - X-Content-Type-Options: Prevents MIME type sniffing
 * - X-XSS-Protection: Enables browser XSS filters
 * - X-Frame-Options: Prevents clickjacking attacks
 * - Referrer-Policy: Controls referrer information
 * - Content-Security-Policy: Restricts resource loading
 * - Strict-Transport-Security (staging/prod): Forces HTTPS
 * 
 * @param {Express} app - Express application instance
 * @returns {void}
 */
export function setupSecurityMiddleware(app: Express): void {
  // Helmet-like lightweight security headers
  app.use((req, res, next) => {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Control referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Content Security Policy (basic)
    res.setHeader("Content-Security-Policy", "default-src 'self'");

    // Remove powered by header
    res.removeHeader('X-Powered-By');

    next();
  });

  // HTTPS enforcement in production and staging
  if (config.isProd || config.isStaging) {
    app.use((req, res, next) => {
      if (req.header('x-forwarded-proto') !== 'https') {
        res.redirect(301, `https://${req.header('host')}${req.url}`);
      } else {
        next();
      }
    });

    // HSTS (HTTP Strict Transport Security)
    app.use((req, res, next) => {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
      next();
    });
  }
}
