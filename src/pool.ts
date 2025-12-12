/**
 * Pool State Management
 *
 * This module manages the state of the ETH/USDC liquidity pool.
 * Think of it as the "bank" that holds the actual tokens and tracks
 * who owns what shares of the pool.
 *
 * Real DEXes would use smart contracts on-chain to enforce these rules.
 * We're doing it in-memory on the backend for education.
 *
 * Key concepts:
 * - Reserves: How many ETH and USDC the pool currently holds
 * - Constant Product (k): ETH * USDC = k (never changes, enforced by pool)
 * - LP Shares: Your ownership stake in the pool
 * - Fees: Accumulated from each trade, goes to liquidity providers
 */

interface PoolState {
  // Reserve balances - these change with every swap and liquidity action
  ethReserve: number;
  usdcReserve: number;

  // Total LP shares issued - tracks how much ownership has been given out
  totalShares: number;

  // Accumulated fees that belong to liquidity providers
  // In real systems, this is tracked per LP. We're simplifying to a single pool.
  accumulatedFees: {
    eth: number;
    usdc: number;
  };

  // Constant product value: ETH * USDC
  // This is not updated after it's set; instead, the formula enforces it dynamically
  // (actual reserves might be slightly different due to swaps, but the formula ensures x*y >= k)
  k: number;
}

// Initialize the pool with realistic values
// These represent the initial liquidity deposit
// 1 ETH token = 1 USDC token (fair starting price)
let pool: PoolState = {
  ethReserve: 1000000,
  usdcReserve: 1000000,
  totalShares: 1000000, // Initial shares = sqrt(ethReserve * usdcReserve)
  accumulatedFees: { eth: 0, usdc: 0 },
  k: 1000000 * 1000000,
};

/**
 * Executes a swap in the pool.
 *
 * This is the core operation that changes reserve balances.
 * It enforces:
 * 1. The constant product formula is maintained
 * 2. Fees are collected
 * 3. Reserves are updated atomically
 *
 * @param inputTokenType - "ETH" or "USDC" (what you're giving)
 * @param outputTokenType - "ETH" or "USDC" (what you're getting)
 * @param amountIn - Amount of input token (after fees deducted)
 * @param amountOut - Amount of output token to give to user
 * @param feeAmount - Fee collected from this swap
 */
export function executeSwap(
  inputTokenType: 'ETH' | 'USDC',
  outputTokenType: 'ETH' | 'USDC',
  amountIn: number,
  amountOut: number,
  feeAmount: number
): void {
  // Update reserves: add input, subtract output
  if (inputTokenType === 'ETH') {
    pool.ethReserve += amountIn;
  } else {
    pool.usdcReserve += amountIn;
  }

  if (outputTokenType === 'ETH') {
    pool.ethReserve -= amountOut;
  } else {
    pool.usdcReserve -= amountOut;
  }

  // Accumulate fees for liquidity providers
  // Fees stay in the pool, making LP shares more valuable over time
  if (inputTokenType === 'ETH') {
    pool.accumulatedFees.eth += feeAmount;
  } else {
    pool.accumulatedFees.usdc += feeAmount;
  }

  // Verify we still have positive reserves (pool isn't broken)
  if (pool.ethReserve <= 0 || pool.usdcReserve <= 0) {
    throw new Error('Swap would break the pool. Reserves must remain positive.');
  }

  // Verify constant product formula holds (or improves due to fees)
  const newK = pool.ethReserve * pool.usdcReserve;
  // Tolerate tiny floating point drift using absolute+relative threshold
  const epsilon = Math.max(1e-3, 5e-15 * pool.k);
  if (newK + epsilon < pool.k) {
    throw new Error(
      `Swap violates constant product formula. K dropped from ${pool.k} to ${newK}`
    );
  }

  // Track k growth (fees increase k over time)
  if (newK > pool.k) {
    pool.k = newK;
  }
}

/**
 * Adds liquidity to the pool and issues LP shares.
 *
 * When someone deposits tokens, they:
 * 1. Transfer ETH and USDC into the pool (reserves increase)
 * 2. Receive LP shares that represent their ownership
 * 3. Become eligible to earn fees from future swaps
 *
 * @param ethAmount - Amount of ETH being deposited
 * @param usdcAmount - Amount of USDC being deposited
 * @param sharesIssued - Number of new LP shares created
 */
export function addLiquidity(
  ethAmount: number,
  usdcAmount: number,
  sharesIssued: number
): void {
  // Add tokens to reserves
  pool.ethReserve += ethAmount;
  pool.usdcReserve += usdcAmount;

  // Issue new shares to the depositor
  pool.totalShares += sharesIssued;

  // The constant product value increases with liquidity addition
  // This is expected and good - it means we have more capital in the pool
  pool.k = pool.ethReserve * pool.usdcReserve;
}

/**
 * Removes liquidity from the pool and burns LP shares.
 *
 * When someone withdraws tokens, they:
 * 1. Burn their LP shares (reduce total shares)
 * 2. Receive proportional ETH and USDC
 * 3. Their share of accumulated fees is included in the withdrawal
 *
 * @param ethAmount - Amount of ETH being withdrawn
 * @param usdcAmount - Amount of USDC being withdrawn
 * @param sharesBurned - Number of LP shares being redeemed
 */
export function withdrawLiquidity(
  ethAmount: number,
  usdcAmount: number,
  sharesBurned: number
): void {
  // Remove tokens from reserves
  pool.ethReserve -= ethAmount;
  pool.usdcReserve -= usdcAmount;

  // Burn the shares (they're gone from circulation)
  pool.totalShares -= sharesBurned;

  // Ensure reserves stay positive
  if (pool.ethReserve <= 0 || pool.usdcReserve <= 0) {
    throw new Error('Withdrawal would deplete reserves. Cannot withdraw this much.');
  }

  // Update k - it decreases when liquidity is removed
  pool.k = pool.ethReserve * pool.usdcReserve;
}

/**
 * Gets current pool state (reserves, shares, k).
 * Read-only - doesn't modify anything.
 */
export function getPoolState(): Readonly<PoolState> {
  return { ...pool };
}

/**
 * Gets ETH reserve balance.
 */
export function getEthReserve(): number {
  return pool.ethReserve;
}

/**
 * Gets USDC reserve balance.
 */
export function getUsdcReserve(): number {
  return pool.usdcReserve;
}

/**
 * Gets total LP shares in circulation.
 * Higher than initial if fees have accumulated.
 */
export function getTotalShares(): number {
  return pool.totalShares;
}

/**
 * Gets the constant product value (k).
 * This increases over time as fees accumulate in the reserves.
 */
export function getK(): number {
  return pool.k;
}

/**
 * Gets accumulated fees earned by the pool.
 * These fees are distributed to LP share holders proportionally.
 */
export function getAccumulatedFees(): { eth: number; usdc: number } {
  return { ...pool.accumulatedFees };
}

/**
 * Checks if a share amount is valid (owner has enough to withdraw/transfer).
 * In a real system, this would check a database of user balances.
 * For this demo, we'll accept any positive share amount.
 */
export function validateShareAmount(shares: number): boolean {
  return shares > 0 && shares <= pool.totalShares;
}

/**
 * Resets pool to initial state.
 * Useful for testing. Don't use in production!
 */
export function resetPool(): void {
  pool = {
    ethReserve: 1000000,
    usdcReserve: 1000000,
    totalShares: 1000000,
    accumulatedFees: { eth: 0, usdc: 0 },
    k: 1000000 * 1000000,
  };
}
