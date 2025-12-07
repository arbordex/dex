import express, { Request, Response } from 'express';
import { config } from './config';
import { setupSecurityMiddleware } from './security';
import * as utils from './utils';
import * as pool from './pool';
import * as validation from './validation';

const app = express();

// Middleware to parse JSON request bodies
app.use(express.json());

// Setup security middleware
setupSecurityMiddleware(app);

// ==============================================================================
// CONFIGURATION & CONSTANTS
// ==============================================================================

/**
 * Swap fee configuration
 *
 * In real DEXes:
 * - Uniswap v3: 0.01%, 0.05%, 0.30%, 1.00% depending on token pair
 * - Uniswap v2: 0.30% flat
 * - Curve: 0.04% for stableswaps, higher for volatile pairs
 *
 * We use 0.30% (Uniswap v2 standard) as it's a reasonable middle ground
 * that compensates liquidity providers fairly without being excessive.
 *
 * How fees work:
 * 1. User submits 100 ETH swap request
 * 2. We charge 0.30% fee = 0.30 ETH
 * 3. Only 99.70 ETH enters the AMM formula
 * 4. User receives output based on 99.70 ETH
 * 5. The 0.30 ETH is added to the pool reserves, benefiting all LP share holders
 */
const SWAP_FEE_PERCENTAGE = 0.003; // 0.3% fee (0.003 as decimal)

/**
 * Slippage tolerance default
 *
 * Slippage is the difference between:
 * - Expected price: when you submit your transaction
 * - Actual price: when it executes on-chain
 *
 * Why it happens:
 * - Block time: ~12 seconds (Ethereum)
 * - Other transactions can execute between submission and execution
 * - Pool reserves change with each transaction
 * - Therefore, your output amount might be different
 *
 * Default 0.5% is reasonable for:
 * - Small to medium trades
 * - Stable market conditions
 * - Normal network congestion
 *
 * Lower is more strict (safer), higher is more permissive (riskier)
 * Users should adjust based on:
 * - Trade size (larger trades = higher slippage usually)
 * - Market volatility (volatile = higher slippage)
 * - Network conditions (congested = higher slippage)
 */
const DEFAULT_SLIPPAGE_TOLERANCE = 0.005; // 0.5%

/**
 * Price impact threshold for warnings
 *
 * Price impact shows how much worse your execution price is vs. spot price
 * High impact indicates:
 * - Your trade is large relative to pool liquidity
 * - You might want to split into smaller trades
 * - You might want to use different route/protocol
 *
 * Above 1% impact, we warn the user but still execute
 * (they might intentionally accept this risk)
 */
const PRICE_IMPACT_WARNING_THRESHOLD = 0.01; // 1%

/**
 * Maximum slippage a user can request
 * Anything above 50% is probably a mistake, so we reject it
 */
const MAX_ALLOWED_SLIPPAGE = 0.5; // 50%

// ==============================================================================
// ENDPOINTS
// ==============================================================================

/**
 * GET / - Health check and welcome message
 *
 * A simple health check endpoint that confirms the server is running.
 * In production, this might also check database connectivity, 
 * and other dependencies.
 *
 * @returns 200 with welcome message
 *
 * Example:
 * curl http://localhost:3000/
 */
app.get('/', (req, res) => {
  res.json({
    message: '👋 Welcome to Arbordex - Your DEX Learning Playground',
    version: '1.0.0',
    endpoints: {
      pool: 'GET /pool/info',
      price: 'GET /pool/price',
      quote: 'POST /quote',
      buy: 'POST /buy',
      sell: 'POST /sell',
      addLiquidity: 'POST /add-liquidity',
      removeLiquidity: 'POST /remove-liquidity',
    },
    docs: 'See README.md for detailed documentation',
  });
});

/**
 * GET /pool/info - Get current pool state
 *
 * Returns the current balances and metrics of the liquidity pool.
 * Think of this as a "bank balance" check for the DEX.
 *
 * What the numbers mean:
 * - ethReserve: How much ETH the pool currently holds
 * - usdcReserve: How much USDC the pool currently holds
 * - totalShares: Total LP shares issued (sum of all LPs' ownership)
 * - k: Constant product (ETH * USDC), increases as fees accumulate
 * - accumulatedFees: Fees collected from all swaps, distributed to LPs
 *
 * Real DEXes track this on-chain in smart contracts;
 * we track it in memory for educational purposes.
 *
 * @returns 200 with pool state
 *
 * Example:
 * curl http://localhost:3000/pool/info
 *
 * Response:
 * {
 *   "ethReserve": 1000000,
 *   "usdcReserve": 1000000,
 *   "totalShares": 1000000,
 *   "k": 1000000000000,
 *   "accumulatedFees": { "eth": 0.5, "usdc": 10.2 }
 * }
 */
app.get('/pool/info', (req, res) => {
  const poolState = pool.getPoolState();

  res.json({
    ethReserve: poolState.ethReserve,
    usdcReserve: poolState.usdcReserve,
    totalShares: poolState.totalShares,
    k: poolState.k,
    accumulatedFees: poolState.accumulatedFees,
  });
});

/**
 * GET /pool/price - Get current spot price
 *
 * Returns the current price of ETH in terms of USDC.
 * This is the price at which a small trade would execute right now.
 *
 * Formula: price = USDC reserve / ETH reserve
 *
 * Example interpretation:
 * - If price = 2.5, then 1 ETH = 2.5 USDC
 * - If price = 0.4, then 1 ETH = 0.4 USDC
 *
 * Why "small trade"?
 * - Large trades have price impact
 * - As you swap in, the ratio shifts
 * - A 0.001 ETH swap gets ~spot price
 * - A 1,000,000 ETH swap gets much worse price due to impact
 *
 * Real-world analogy:
 * - You ask a currency exchange: "What's the EUR/USD rate?"
 * - They tell you 1 EUR = 1.10 USD
 * - That's TODAY'S spot price
 * - If you exchange 1 million EUR, they might give you worse rate
 * - But for small amounts, you get ~spot price
 *
 * @returns 200 with price in USDC per ETH
 *
 * Example:
 * curl http://localhost:3000/pool/price
 *
 * Response:
 * {
 *   "ethPriceInUsdc": 1.0,
 *   "interpretation": "1 ETH = 1.0 USDC"
 * }
 */
app.get('/pool/price', (req, res) => {
  const ethReserve = pool.getEthReserve();
  const usdcReserve = pool.getUsdcReserve();

  const spotPrice = utils.calculateSpotPrice(usdcReserve, ethReserve);

  res.json({
    ethPriceInUsdc: spotPrice,
    interpretation: `1 ETH = ${spotPrice.toFixed(6)} USDC`,
  });
});

/**
 * POST /quote - Get a quote for a swap (doesn't execute)
 *
 * Before executing a swap, you want to know:
 * "If I swap 10 ETH, how much USDC will I get?"
 *
 * This endpoint calculates that WITHOUT executing the swap.
 * It's "read-only" - no pool balances change.
 *
 * This is crucial in real DEXes because:
 * 1. You can show users the expected output before they confirm
 * 2. You can calculate slippage (expected vs actual)
 * 3. You can check if the output meets your minimum (slippage tolerance)
 *
 * Request body:
 * {
 *   "inputToken": "ETH",           // Token you're giving
 *   "outputToken": "USDC",          // Token you're receiving
 *   "amount": 10,                   // How much you're swapping
 *   "slippageTolerance": 0.005      // Optional, defaults to 0.5%
 * }
 *
 * Response includes:
 * - expectedOutput: Amount you'd get (before slippage applied)
 * - fee: Amount charged as fee
 * - amountAfterFee: Input amount after fee deducted
 * - priceImpact: How much worse than spot price
 * - minimumOutput: Minimum acceptable (with slippage tolerance)
 *
 * Example:
 * curl -X POST http://localhost:3000/quote \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "inputToken": "ETH",
 *     "outputToken": "USDC",
 *     "amount": 10,
 *     "slippageTolerance": 0.005
 *   }'
 *
 * Response:
 * {
 *   "inputToken": "ETH",
 *   "outputToken": "USDC",
 *   "inputAmount": 10,
 *   "fee": 0.03,
 *   "amountAfterFee": 9.97,
 *   "expectedOutput": 9.97,
 *   "priceImpact": 0.0030,
 *   "slippageTolerance": 0.005,
 *   "minimumOutput": 9.915,
 *   "message": "Expected 9.97 USDC for 10 ETH, accept minimum 9.915"
 * }
 */
app.post('/quote', (req: Request, res: Response) => {
  try {
    const { inputToken, outputToken, amount, slippageTolerance = DEFAULT_SLIPPAGE_TOLERANCE } =
      req.body;

    // Validate inputs
    const pairValidation = validation.validateSwapPair(inputToken, outputToken);
    if (!pairValidation.valid) {
      return res.status(400).json({ error: pairValidation.error });
    }

    const amountValidation = validation.validateSwapAmount(amount);
    if (!amountValidation.valid) {
      return res.status(400).json({ error: amountValidation.error });
    }

    const slippageValidation = validation.validateSlippageTolerance(slippageTolerance);
    if (!slippageValidation.valid) {
      return res.status(400).json({ error: slippageValidation.error });
    }

    // Get current pool reserves
    const ethReserve = pool.getEthReserve();
    const usdcReserve = pool.getUsdcReserve();

    // Determine input and output reserves based on token types
    const inputReserve = inputToken === 'ETH' ? ethReserve : usdcReserve;
    const outputReserve = inputToken === 'ETH' ? usdcReserve : ethReserve;

    // Calculate fee
    const { fee, amountAfterFee } = utils.calculateFee(amount, SWAP_FEE_PERCENTAGE);

    // Calculate output using constant product formula
    const expectedOutput = utils.calculateOutputAmount(amountAfterFee, inputReserve, outputReserve);

    // Calculate spot price for price impact calculation
    const spotPrice = utils.calculateSpotPrice(outputReserve, inputReserve);

    // Calculate price impact
    const priceImpact = utils.calculatePriceImpact(expectedOutput, amountAfterFee, spotPrice);

    // Check price impact
    const impactValidation = validation.validatePriceImpact(priceImpact);

    // Calculate minimum acceptable output with slippage tolerance
    const minimumOutput = utils.calculateMinimumOutput(expectedOutput, slippageTolerance);

    res.json({
      inputToken,
      outputToken,
      inputAmount: amount,
      fee: Math.round(fee * 1000000) / 1000000, // Round to 6 decimals
      amountAfterFee: Math.round(amountAfterFee * 1000000) / 1000000,
      expectedOutput: Math.round(expectedOutput * 1000000) / 1000000,
      priceImpact: Math.round(priceImpact * 10000) / 10000, // As percentage
      slippageTolerance: slippageTolerance * 100,
      minimumOutput: Math.round(minimumOutput * 1000000) / 1000000,
      warning: impactValidation.warning,
      message: `Expected ${Math.round(expectedOutput * 1000000) / 1000000} ${outputToken} for ${amount} ${inputToken}, accept minimum ${Math.round(minimumOutput * 1000000) / 1000000}`,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /buy - Swap ETH for USDC (simulates buying USDC with ETH)
 *
 * Executes a swap: ETH → USDC
 * This is called "buying" in DEX terminology (buying USDC with your ETH)
 *
 * Process:
 * 1. Validate input amount and slippage tolerance
 * 2. Calculate expected output using /quote logic
 * 3. Calculate minimum acceptable output
 * 4. Execute the swap (update pool reserves, collect fees)
 * 5. Return transaction details
 *
 * Security checks:
 * - Validates amount is in reasonable bounds
 * - Checks slippage tolerance is realistic
 * - Ensures output meets minimum threshold
 * - Prevents accidental massive swaps
 *
 * Request body:
 * {
 *   "ethAmount": 10,
 *   "minUsdcOutput": 9.9,              // Optional minimum, for safety
 *   "slippageTolerance": 0.005         // Optional, defaults to 0.5%
 * }
 *
 * Example:
 * curl -X POST http://localhost:3000/buy \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "ethAmount": 10,
 *     "slippageTolerance": 0.005
 *   }'
 *
 * Response:
 * {
 *   "status": "success",
 *   "transaction": {
 *     "type": "swap",
 *     "from": "ETH",
 *     "to": "USDC",
 *     "inputAmount": 10,
 *     "fee": 0.03,
 *     "outputAmount": 9.97,
 *     "priceImpact": 0.003,
 *     "poolEthAfter": 1000010,
 *     "poolUsdcAfter": 999990.03
 *   }
 * }
 */
app.post('/buy', (req: Request, res: Response) => {
  try {
    const { ethAmount, minUsdcOutput, slippageTolerance = DEFAULT_SLIPPAGE_TOLERANCE } = req.body;

    // Validate input
    const amountValidation = validation.validateSwapAmount(ethAmount);
    if (!amountValidation.valid) {
      return res.status(400).json({ error: amountValidation.error });
    }

    const slippageValidation = validation.validateSlippageTolerance(slippageTolerance);
    if (!slippageValidation.valid) {
      return res.status(400).json({ error: slippageValidation.error });
    }

    // Get current pool state
    const ethReserve = pool.getEthReserve();
    const usdcReserve = pool.getUsdcReserve();

    // Calculate fee and output
    const { fee, amountAfterFee } = utils.calculateFee(ethAmount, SWAP_FEE_PERCENTAGE);
    const expectedOutput = utils.calculateOutputAmount(amountAfterFee, ethReserve, usdcReserve);
    const spotPrice = utils.calculateSpotPrice(usdcReserve, ethReserve);
    const priceImpact = utils.calculatePriceImpact(expectedOutput, amountAfterFee, spotPrice);
    const minimumOutput = utils.calculateMinimumOutput(expectedOutput, slippageTolerance);

    // If user specified a minimum, use the larger of the two
    const finalMinimumOutput = Math.max(minimumOutput, minUsdcOutput || 0);

    // Check slippage
    if (!utils.isSlippageAcceptable(expectedOutput, finalMinimumOutput)) {
      return res.status(400).json({
        error: `Slippage exceeded. Expected ${Math.round(expectedOutput * 1000000) / 1000000} USDC, minimum ${Math.round(finalMinimumOutput * 1000000) / 1000000}.`,
      });
    }

    // Execute the swap on the pool
    pool.executeSwap('ETH', 'USDC', amountAfterFee, expectedOutput, fee);

    // Return transaction details
    res.json({
      status: 'success',
      transaction: {
        type: 'swap',
        from: 'ETH',
        to: 'USDC',
        inputAmount: ethAmount,
        fee: Math.round(fee * 1000000) / 1000000,
        outputAmount: Math.round(expectedOutput * 1000000) / 1000000,
        priceImpact: Math.round(priceImpact * 10000) / 10000,
        poolEthAfter: pool.getEthReserve(),
        poolUsdcAfter: pool.getUsdcReserve(),
        message: `Swapped ${ethAmount} ETH for ${Math.round(expectedOutput * 1000000) / 1000000} USDC`,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /sell - Swap USDC for ETH (simulates selling USDC for ETH)
 *
 * Executes a swap: USDC → ETH
 * This is called "selling" in DEX terminology (selling your USDC for ETH)
 *
 * Same logic as /buy endpoint, but in reverse direction.
 * See /buy documentation for detailed explanation.
 *
 * Request body:
 * {
 *   "usdcAmount": 10,
 *   "minEthOutput": 9.9,               // Optional minimum, for safety
 *   "slippageTolerance": 0.005         // Optional, defaults to 0.5%
 * }
 *
 * Example:
 * curl -X POST http://localhost:3000/sell \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "usdcAmount": 10,
 *     "slippageTolerance": 0.005
 *   }'
 */
app.post('/sell', (req: Request, res: Response) => {
  try {
    const { usdcAmount, minEthOutput, slippageTolerance = DEFAULT_SLIPPAGE_TOLERANCE } = req.body;

    // Validate input
    const amountValidation = validation.validateSwapAmount(usdcAmount);
    if (!amountValidation.valid) {
      return res.status(400).json({ error: amountValidation.error });
    }

    const slippageValidation = validation.validateSlippageTolerance(slippageTolerance);
    if (!slippageValidation.valid) {
      return res.status(400).json({ error: slippageValidation.error });
    }

    // Get current pool state
    const ethReserve = pool.getEthReserve();
    const usdcReserve = pool.getUsdcReserve();

    // Calculate fee and output (USDC input → ETH output)
    const { fee, amountAfterFee } = utils.calculateFee(usdcAmount, SWAP_FEE_PERCENTAGE);
    const expectedOutput = utils.calculateOutputAmount(amountAfterFee, usdcReserve, ethReserve);
    const spotPrice = utils.calculateSpotPrice(ethReserve, usdcReserve);
    const priceImpact = utils.calculatePriceImpact(expectedOutput, amountAfterFee, spotPrice);
    const minimumOutput = utils.calculateMinimumOutput(expectedOutput, slippageTolerance);

    // If user specified a minimum, use the larger of the two
    const finalMinimumOutput = Math.max(minimumOutput, minEthOutput || 0);

    // Check slippage
    if (!utils.isSlippageAcceptable(expectedOutput, finalMinimumOutput)) {
      return res.status(400).json({
        error: `Slippage exceeded. Expected ${Math.round(expectedOutput * 1000000) / 1000000} ETH, minimum ${Math.round(finalMinimumOutput * 1000000) / 1000000}.`,
      });
    }

    // Execute the swap on the pool
    pool.executeSwap('USDC', 'ETH', amountAfterFee, expectedOutput, fee);

    // Return transaction details
    res.json({
      status: 'success',
      transaction: {
        type: 'swap',
        from: 'USDC',
        to: 'ETH',
        inputAmount: usdcAmount,
        fee: Math.round(fee * 1000000) / 1000000,
        outputAmount: Math.round(expectedOutput * 1000000) / 1000000,
        priceImpact: Math.round(priceImpact * 10000) / 10000,
        poolEthAfter: pool.getEthReserve(),
        poolUsdcAfter: pool.getUsdcReserve(),
        message: `Swapped ${usdcAmount} USDC for ${Math.round(expectedOutput * 1000000) / 1000000} ETH`,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /add-liquidity - Add tokens to the pool and receive LP shares
 *
 * When you add liquidity to a DEX, you:
 * 1. Deposit both tokens (in correct ratio)
 * 2. Receive LP (Liquidity Provider) shares
 * 3. Become entitled to earn fees from all future swaps
 *
 * Why provide liquidity?
 * - Earn fees: Every swap fees collected goes to pool
 * - Share income: Your % of shares = your % of fees
 * - Example: If pool earns 1000 USDC in fees and you own 1% of shares, you own 10 USDC of fees
 *
 * LP share math:
 * - First deposit: Arbitrary base (typically sqrt of product)
 * - Subsequent deposits: Proportional to your contribution
 * - Example:
 *   - Pool: 1000 ETH, 1000 USDC, 1000 shares
 *   - You deposit: 100 ETH, 100 USDC
 *   - You get: 100 shares (10% ownership)
 *   - After: 1100 ETH, 1100 USDC, 1100 shares total
 *
 * Risks:
 * - Impermanent loss: If prices diverge significantly, you might have less total value than if you held tokens
 * - Smart contract risk: Bugs could drain your deposits (we're not worried about this in educational mode)
 *
 * Request body:
 * {
 *   "ethAmount": 100,
 *   "usdcAmount": 100
 * }
 *
 * Example:
 * curl -X POST http://localhost:3000/add-liquidity \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "ethAmount": 100,
 *     "usdcAmount": 100
 *   }'
 *
 * Response:
 * {
 *   "status": "success",
 *   "liquidity": {
 *     "ethAdded": 100,
 *     "usdcAdded": 100,
 *     "sharesIssued": 100,
 *     "poolEthAfter": 1000100,
 *     "poolUsdcAfter": 1000100,
 *     "totalSharesAfter": 1000100,
 *     "message": "Added 100 ETH and 100 USDC, received 100 LP shares"
 *   }
 * }
 */
app.post('/add-liquidity', (req: Request, res: Response) => {
  try {
    const { ethAmount, usdcAmount } = req.body;

    // Get current pool state
    const ethReserve = pool.getEthReserve();
    const usdcReserve = pool.getUsdcReserve();
    const totalShares = pool.getTotalShares();

    // Validate liquidity addition
    const validation_result = validation.validateAddLiquidity(
      ethAmount,
      usdcAmount,
      ethReserve,
      usdcReserve
    );
    if (!validation_result.valid) {
      return res.status(400).json({ error: validation_result.error });
    }

    // Calculate shares earned
    const sharesEarned = utils.calculateLiquidityShares(
      ethAmount,
      usdcAmount,
      ethReserve,
      usdcReserve,
      totalShares
    );

    // Execute the liquidity addition
    pool.addLiquidity(ethAmount, usdcAmount, sharesEarned);

    res.json({
      status: 'success',
      liquidity: {
        ethAdded: ethAmount,
        usdcAdded: usdcAmount,
        sharesIssued: Math.round(sharesEarned * 1000000) / 1000000,
        poolEthAfter: pool.getEthReserve(),
        poolUsdcAfter: pool.getUsdcReserve(),
        totalSharesAfter: pool.getTotalShares(),
        message: `Added ${ethAmount} ETH and ${usdcAmount} USDC, received ${Math.round(sharesEarned * 1000000) / 1000000} LP shares`,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /remove-liquidity - Burn LP shares and withdraw tokens
 *
 * When you remove liquidity:
 * 1. Burn your LP shares
 * 2. Receive proportional ETH and USDC
 * 3. Your share of accumulated fees is included
 *
 * Withdrawal math:
 * - You own (shares / totalShares) of the pool
 * - You get that fraction of BOTH reserves
 * - Example:
 *   - Pool: 1100 ETH, 1100 USDC, 1100 shares
 *   - You burn: 100 shares (9.09% ownership)
 *   - You get: 1100 * 0.0909 = 100 ETH, 1100 * 0.0909 = 100 USDC
 *   - Plus your share of any accumulated fees
 *
 * Why you might withdraw:
 * - Realize your profits (harvest fees earned)
 * - Exit a position (stop being LP)
 * - Rebalance your portfolio
 *
 * Request body:
 * {
 *   "sharesToBurn": 100
 * }
 *
 * Example:
 * curl -X POST http://localhost:3000/remove-liquidity \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "sharesToBurn": 100
 *   }'
 *
 * Response:
 * {
 *   "status": "success",
 *   "liquidity": {
 *     "sharesBurned": 100,
 *     "ethWithdrawn": 100,
 *     "usdcWithdrawn": 100,
 *     "poolEthAfter": 1000000,
 *     "poolUsdcAfter": 1000000,
 *     "totalSharesAfter": 1000000,
 *     "message": "Burned 100 shares, withdrawn 100 ETH and 100 USDC"
 *   }
 * }
 */
app.post('/remove-liquidity', (req: Request, res: Response) => {
  try {
    const { sharesToBurn } = req.body;

    // Get current pool state
    const ethReserve = pool.getEthReserve();
    const usdcReserve = pool.getUsdcReserve();
    const totalShares = pool.getTotalShares();

    // Validate share amount
    if (!validation.validateShareAmount(sharesToBurn)) {
      return res.status(400).json({
        error: `Invalid shares: ${sharesToBurn}. Must be positive and <= ${totalShares}.`,
      });
    }

    // Calculate withdrawal amounts
    const { ethAmount, usdcAmount } = utils.calculateWithdrawalAmounts(
      sharesToBurn,
      ethReserve,
      usdcReserve,
      totalShares
    );

    // Validate withdrawal
    const validation_result = validation.validateWithdrawLiquidity(
      sharesToBurn,
      ethAmount,
      usdcAmount,
      ethReserve,
      usdcReserve
    );
    if (!validation_result.valid) {
      return res.status(400).json({ error: validation_result.error });
    }

    // Execute the withdrawal
    pool.withdrawLiquidity(ethAmount, usdcAmount, sharesToBurn);

    res.json({
      status: 'success',
      liquidity: {
        sharesBurned: sharesToBurn,
        ethWithdrawn: Math.round(ethAmount * 1000000) / 1000000,
        usdcWithdrawn: Math.round(usdcAmount * 1000000) / 1000000,
        poolEthAfter: pool.getEthReserve(),
        poolUsdcAfter: pool.getUsdcReserve(),
        totalSharesAfter: pool.getTotalShares(),
        message: `Burned ${sharesToBurn} shares, withdrawn ${Math.round(ethAmount * 1000000) / 1000000} ETH and ${Math.round(usdcAmount * 1000000) / 1000000} USDC`,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ==============================================================================
// SERVER STARTUP
// ==============================================================================

app.listen(config.port, config.host, () => {
  const protocol = config.isProd ? 'https' : 'http';
  console.log(`Server is running on ${protocol}://${config.host}:${config.port}`);
  console.log(`Environment: ${config.env}`);
  console.log('');
  console.log('Available endpoints:');
  console.log('  GET  /              - Welcome & endpoints list');
  console.log('  GET  /pool/info     - Get pool state');
  console.log('  GET  /pool/price    - Get current price');
  console.log('  POST /quote         - Get swap quote (no execution)');
  console.log('  POST /buy           - Swap ETH for USDC');
  console.log('  POST /sell          - Swap USDC for ETH');
  console.log('  POST /add-liquidity - Add liquidity and get LP shares');
  console.log('  POST /remove-liquidity - Burn LP shares and withdraw');
});