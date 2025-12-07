/**
 * Input Validation and Security Checks
 *
 * This module validates all user inputs to ensure:
 * 1. Amounts are sensible (not negative, not impossibly large)
 * 2. Operations won't break the pool
 * 3. Security thresholds aren't exceeded
 *
 * In a real system, this would also check user balances on-chain,
 * verify signatures, and prevent reentrancy attacks.
 */

// Constants for security thresholds
const MIN_TRADE_AMOUNT = 0.01; // Minimum 0.01 tokens per trade (prevents dust)
const MAX_TRANSACTION_SIZE = 100000; // Maximum 100k tokens per trade
const MIN_POOL_RESERVE = 100; // Pool must have at least this much liquidity
const MAX_SLIPPAGE_TOLERANCE = 0.5; // Max slippage tolerance 50% (beyond this is unreasonable)
const MIN_SLIPPAGE_TOLERANCE = 0.0001; // Min slippage tolerance 0.01% (tighter than typical)

export interface ValidationError {
  valid: boolean;
  error?: string;
}

/**
 * Validates a swap input amount.
 *
 * Checks:
 * - Amount is positive and within reasonable bounds
 * - Not too small (creates unnecessary gas overhead)
 * - Not too large (prevents accidental massive swaps)
 *
 * @param amount - Amount being swapped
 * @returns { valid: boolean, error?: string }
 */
export function validateSwapAmount(amount: number): ValidationError {
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      valid: false,
      error: `Invalid amount: ${amount}. Must be a positive number.`,
    };
  }

  if (amount < MIN_TRADE_AMOUNT) {
    return {
      valid: false,
      error: `Amount too small: ${amount}. Minimum is ${MIN_TRADE_AMOUNT}.`,
    };
  }

  if (amount > MAX_TRANSACTION_SIZE) {
    return {
      valid: false,
      error: `Amount too large: ${amount}. Maximum is ${MAX_TRANSACTION_SIZE}.`,
    };
  }

  return { valid: true };
}

/**
 * Validates liquidity addition inputs.
 *
 * Checks:
 * - Both amounts are positive
 * - Both are within reasonable bounds
 * - Pool will have minimum liquidity after operation
 * - Amounts are proportional (ratio matches pool ratio for non-first deposit)
 *
 * @param ethAmount - ETH being deposited
 * @param usdcAmount - USDC being deposited
 * @param currentEthReserve - Current ETH in pool
 * @param currentUsdcReserve - Current USDC in pool
 * @returns { valid: boolean, error?: string }
 */
export function validateAddLiquidity(
  ethAmount: number,
  usdcAmount: number,
  currentEthReserve: number,
  currentUsdcReserve: number
): ValidationError {
  // Validate both amounts
  const ethValidation = validateSwapAmount(ethAmount);
  if (!ethValidation.valid) {
    return { valid: false, error: `ETH: ${ethValidation.error}` };
  }

  const usdcValidation = validateSwapAmount(usdcAmount);
  if (!usdcValidation.valid) {
    return { valid: false, error: `USDC: ${usdcValidation.error}` };
  }

  // For non-initial deposits, ensure amounts are proportional
  // This prevents someone from adding 100 ETH but only 10 USDC
  if (currentEthReserve > 0 && currentUsdcReserve > 0) {
    const ethRatio = ethAmount / currentEthReserve;
    const usdcRatio = usdcAmount / currentUsdcReserve;

    // Allow 1% tolerance for rounding differences
    const tolerance = 0.01;
    if (Math.abs(ethRatio - usdcRatio) / ethRatio > tolerance) {
      return {
        valid: false,
        error: `Amounts not proportional. ETH ratio: ${ethRatio.toFixed(4)}, USDC ratio: ${usdcRatio.toFixed(4)}. They should be equal.`,
      };
    }
  }

  // Check pool will have minimum liquidity after operation
  if (currentEthReserve + ethAmount < MIN_POOL_RESERVE) {
    return {
      valid: false,
      error: `Pool ETH would drop below minimum ${MIN_POOL_RESERVE}`,
    };
  }

  if (currentUsdcReserve + usdcAmount < MIN_POOL_RESERVE) {
    return {
      valid: false,
      error: `Pool USDC would drop below minimum ${MIN_POOL_RESERVE}`,
    };
  }

  return { valid: true };
}

/**
 * Validates liquidity withdrawal inputs.
 *
 * Checks:
 * - Shares amount is positive and valid
 * - Pool will have minimum liquidity after withdrawal
 * - Withdrawal won't drain the pool
 *
 * @param shares - Number of LP shares being burned
 * @param ethAmount - ETH that would be withdrawn
 * @param usdcAmount - USDC that would be withdrawn
 * @param currentEthReserve - Current ETH in pool
 * @param currentUsdcReserve - Current USDC in pool
 * @returns { valid: boolean, error?: string }
 */
export function validateWithdrawLiquidity(
  shares: number,
  ethAmount: number,
  usdcAmount: number,
  currentEthReserve: number,
  currentUsdcReserve: number
): ValidationError {
  // Validate share amount
  if (!Number.isFinite(shares) || shares <= 0) {
    return {
      valid: false,
      error: `Invalid shares: ${shares}. Must be positive.`,
    };
  }

  if (shares > currentEthReserve) {
    // Rough check - can't withdraw more shares than pool tokens
    return {
      valid: false,
      error: `Insufficient shares: ${shares}. Pool doesn't have enough.`,
    };
  }

  // Check pool won't be depleted
  if (currentEthReserve - ethAmount < MIN_POOL_RESERVE) {
    return {
      valid: false,
      error: `Withdrawal would deplete pool. ETH would be ${(currentEthReserve - ethAmount).toFixed(2)}, minimum ${MIN_POOL_RESERVE}.`,
    };
  }

  if (currentUsdcReserve - usdcAmount < MIN_POOL_RESERVE) {
    return {
      valid: false,
      error: `Withdrawal would deplete pool. USDC would be ${(currentUsdcReserve - usdcAmount).toFixed(2)}, minimum ${MIN_POOL_RESERVE}.`,
    };
  }

  return { valid: true };
}

/**
 * Validates slippage tolerance.
 *
 * Slippage tolerance is a safety parameter you set when swapping:
 * "I'll accept at most 0.5% worse price than expected"
 *
 * This prevents you from accepting terrible execution prices
 * (e.g., due to a transaction being delayed and prices moving)
 *
 * @param slippageTolerance - Slippage tolerance as decimal (0.005 = 0.5%)
 * @returns { valid: boolean, error?: string }
 */
export function validateSlippageTolerance(slippageTolerance: number): ValidationError {
  if (!Number.isFinite(slippageTolerance) || slippageTolerance < 0) {
    return {
      valid: false,
      error: `Invalid slippage tolerance: ${slippageTolerance}. Must be >= 0.`,
    };
  }

  if (slippageTolerance < MIN_SLIPPAGE_TOLERANCE) {
    return {
      valid: false,
      error: `Slippage tolerance too strict: ${(slippageTolerance * 100).toFixed(3)}%. Minimum is ${(MIN_SLIPPAGE_TOLERANCE * 100).toFixed(3)}%.`,
    };
  }

  if (slippageTolerance > MAX_SLIPPAGE_TOLERANCE) {
    return {
      valid: false,
      error: `Slippage tolerance too loose: ${(slippageTolerance * 100).toFixed(1)}%. Maximum is ${(MAX_SLIPPAGE_TOLERANCE * 100).toFixed(1)}%.`,
    };
  }

  return { valid: true };
}

/**
 * Validates price impact.
 *
 * High price impact means your swap will move the price significantly.
 * This is usually a sign to:
 * 1. Split the trade into smaller swaps
 * 2. Wait for better liquidity
 * 3. Reconsider the trade size
 *
 * We warn on high impact but allow it (users might intentionally accept it).
 *
 * @param priceImpact - Price impact as decimal (0.05 = 5%)
 * @returns { valid: boolean, warning?: string }
 */
export function validatePriceImpact(priceImpact: number): { valid: boolean; warning?: string } {
  const warningThreshold = 0.05; // 5% impact is concerning

  if (priceImpact < 0 || priceImpact > 1) {
    return { valid: false }; // Should never happen with proper calculations
  }

  if (priceImpact > warningThreshold) {
    return {
      valid: true,
      warning: `High price impact: ${(priceImpact * 100).toFixed(2)}%. Consider splitting into smaller trades.`,
    };
  }

  return { valid: true };
}

/**
 * Validates token type.
 * Only ETH and USDC are supported in this pool.
 *
 * @param token - Token symbol (e.g., "ETH", "USDC")
 * @returns true if token is valid, false otherwise
 */
export function validateTokenType(token: string): boolean {
  return token === 'ETH' || token === 'USDC';
}

/**
 * Validates a swap pair.
 * Can't swap token for itself.
 *
 * @param inputToken - Input token type
 * @param outputToken - Output token type
 * @returns { valid: boolean, error?: string }
 */
export function validateSwapPair(
  inputToken: string,
  outputToken: string
): ValidationError {
  if (!validateTokenType(inputToken)) {
    return { valid: false, error: `Invalid input token: ${inputToken}. Must be ETH or USDC.` };
  }

  if (!validateTokenType(outputToken)) {
    return { valid: false, error: `Invalid output token: ${outputToken}. Must be ETH or USDC.` };
  }

  if (inputToken === outputToken) {
    return {
      valid: false,
      error: `Cannot swap ${inputToken} for itself. Must be different tokens.`,
    };
  }

  return { valid: true };
}
