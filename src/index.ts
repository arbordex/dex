import express from 'express';
import { config } from './config';
import { setupSecurityMiddleware } from './security';

const app = express();

// Setup security middleware
setupSecurityMiddleware(app);

/**
 * GET / - Health check and welcome message
 * @returns {string} Welcome message
 */
app.get('/', (req, res) => {
  res.send('👋 Welcome to Arbordex! Your DEX learning playground is ready. Try the API endpoints to see swaps in action.');
});

/**
 * POST /add-liquidity - Add liquidity to a pool
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {object} Status message (endpoint under construction)
 */
app.post('/add-liquidity', (req, res) => {
  res.json({ message: '🚧 API Endpoint Under Construction: Feature for adding Liquidity to pool coming soon!' });
});

/**
 * POST /buy - Buy tokens via swap
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {object} Status message (endpoint under construction)
 */
app.post('/buy', (req, res) => {
  res.json({ message: '🚧 API Endpoint Under Construction: Feature to enable Asset Buying coming soon!' });
});

/**
 * POST /sell - Sell tokens via swap
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {object} Status message (endpoint under construction)
 */
app.post('/sell', (req, res) => {
  res.json({ message: '🚧 API Endpoint Under Construction: Feature to enable Asset Selling coming soon!' });
});

/**
 * POST /quote - Get a quote for a swap
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {object} Status message (endpoint under construction)
 */
app.post('/quote', (req, res) => {
  res.json({ message: '🚧 API Endpoint Under Construction: Feature to check quotes coming soon!' });
});

app.listen(config.port, config.host, () => {
  const protocol = config.isProd ? 'https' : 'http';
  console.log(`Server is running on ${protocol}://${config.host}:${config.port}`);
  console.log(`Environment: ${config.env}`);
});