/**
 * Utility functions for AMM (Automated Market Maker) calculations
 *
 * This file contains all the mathematical formulas used in a constant-product AMM,
 * like Uniswap. If you're new to DeFi, think of an AMM as a smart vending machine
 * where the price adjusts based on supply and demand automatically via a mathematical formula.
 *
 * The core principle: x * y = k
 * Where x = ETH balance, y = USDC balance, k = constant product
 * As x increases (you deposit), y decreases (you withdraw), keeping k constant.
 */

/**
 * Calculates the output amount for a token swap using the constant product formula.
 *
 * Formula: outputAmount = (inputAmount * outputReserve) / (inputReserve + inputAmount)
 *
 * Why this formula?
 * - In an AMM, the product of token reserves must stay constant: x * y = k
 * - When you add inputAmount to inputReserve, the reserve becomes (x + inputAmount)
 * - To keep the product constant, outputReserve shrinks to k / (x + inputAmount)
 * - The decrease in outputReserve is what you receive: originalY - newY
 *
 * Example:
 * - ETH balance (x) = 1000, USDC balance (y) = 1000, so k = 1,000,000
 * - You want to swap 10 ETH for USDC
 * - New ETH balance will be 1010, so new USDC balance must be 1,000,000 / 1010 ≈ 990.1
 * - You get 1000 - 990.1 = 9.9 USDC (less than the 1:1 price due to price impact)
 *
 * @param inputAmount - Amount of input token (e.g., ETH amount being swapped)
 * @param inputReserve - Current pool balance of input token (e.g., total ETH in pool)
 * @param outputReserve - Current pool balance of output token (e.g., total USDC in pool)
 * @returns Calculated output amount before fees
 */
export function calculateOutputAmount(
  inputAmount: number,
  inputReserve: number,
  outputReserve: number
): number {
  // Ensure we're working with positive numbers to avoid mathematical errors
  if (inputAmount <= 0 || inputReserve <= 0 || outputReserve <= 0) {
    throw new Error('All amounts must be positive');
  }

  // Apply the constant product formula: y = (inputAmount * outputReserve) / (inputReserve + inputAmount)
  const outputAmount = (inputAmount * outputReserve) / (inputReserve + inputAmount);

  return outputAmount;
}

/**
 * Calculates the fee amount and fee-adjusted output.
 *
 * In real AMMs, a small percentage fee is charged on every swap.
 * This fee goes to liquidity providers as compensation for providing liquidity.
 *
 * Why fees matter?
 * - Without fees, anyone could profit by buying from the AMM and selling elsewhere (arbitrage abuse)
 * - Fees incentivize liquidity providers to lock capital in the pool
 * - Fee percentage is typically 0.3% - 1% depending on the AMM (Uniswap charges 0.3%)
 *
 * Fee calculation:
 * - Fee is taken from the input amount before it enters the AMM formula
 * - So if you want to swap 100 tokens with 0.3% fee, you pay 100 + 0.3 = 100.3 total
 * - The 0.3 fee goes to liquidity providers, and 100 enters the AMM formula
 *
 * @param inputAmount - Total input amount (before fee deduction)
 * @param feePercentage - Fee as a decimal (0.003 = 0.3%)
 * @returns { fee: amount charged as fee, amountAfterFee: amount entering the AMM formula }
 */
export function calculateFee(
  inputAmount: number,
  feePercentage: number
): { fee: number; amountAfterFee: number } {
  // Fee is calculated as a percentage of the input
  const fee = inputAmount * feePercentage;

  // The amount that actually goes into the AMM calculation
  const amountAfterFee = inputAmount - fee;

  return { fee, amountAfterFee };
}

/**
 * Calculates price impact of a swap.
 *
 * Price impact shows how much worse your execution price is compared to the spot price.
 * Larger swaps cause higher price impact because they move the price further.
 *
 * Formula:
 * - Execution price = output amount / input amount
 * - Spot price = output reserve / input reserve (the theoretical "fair" price)
 * - Price impact = 1 - (execution price / spot price)
 * - Expressed as percentage
 *
 * Why it matters:
 * - Shows you how much worse you're trading compared to the market
 * - A 10% swap might have 0.5% impact (you get 0.5% less than market price)
 * - A 50% swap might have 5% impact (you get 5% less than market price)
 * - High impact swaps are risky and sign you should split them into smaller trades
 *
 * Example:
 * - You swap 10 ETH in a pool with 1000 ETH and 1000 USDC
 * - Spot price = 1000 USDC / 1000 ETH = 1 USDC/ETH
 * - You get ~9.9 USDC (from constant product formula)
 * - Execution price = 9.9 / 10 = 0.99 USDC/ETH
 * - Price impact = 1 - (0.99 / 1) = 0.01 = 1%
 *
 * @param outputAmount - Actual amount you receive from the swap
 * @param inputAmount - Amount you're swapping
 * @param spotPrice - Current price (output reserve / input reserve)
 * @returns Price impact as a decimal (0.01 = 1%)
 */
export function calculatePriceImpact(
  outputAmount: number,
  inputAmount: number,
  spotPrice: number
): number {
  // The price you actually got
  const executionPrice = outputAmount / inputAmount;

  // How much worse than the spot price
  const priceImpact = 1 - (executionPrice / spotPrice);

  return Math.max(0, priceImpact); // Ensure it's never negative
}

/**
 * Calculates slippage tolerance check.
 *
 * Slippage is the difference between the price you expect when you submit
 * a transaction and the price when it actually gets executed on-chain.
 *
 * Why it matters?
 * - Block times = transactions take a few seconds to execute
 * - Other traders can execute between your submission and execution
 * - This changes the pool balances and thus the output you receive
 * - You set a "slippage tolerance" to reject unfavorable trades
 * - Example: expecting 10 USDC but accepting minimum 9.95 USDC (0.5% slippage)
 *
 * In this implementation:
 * - We calculate minimum acceptable output given slippage tolerance
 * - If actual output < minimum, reject the trade
 *
 * @param expectedOutput - Output amount calculated in /quote endpoint
 * @param slippageTolerance - Max acceptable slippage as decimal (0.005 = 0.5%)
 * @returns Minimum acceptable output amount
 */
export function calculateMinimumOutput(
  expectedOutput: number,
  slippageTolerance: number
): number {
  // Minimum = expected * (1 - slippage tolerance)
  // Example: 10 * (1 - 0.005) = 10 * 0.995 = 9.95
  const minimumOutput = expectedOutput * (1 - slippageTolerance);

  return minimumOutput;
}

/**
 * Validates if a slippage scenario is acceptable.
 *
 * Compares actual output against minimum acceptable output.
 *
 * @param actualOutput - Output you actually received
 * @param minimumOutput - Minimum acceptable output (calculated with slippage tolerance)
 * @returns true if actual >= minimum (trade is acceptable), false otherwise
 */
export function isSlippageAcceptable(actualOutput: number, minimumOutput: number): boolean {
  return actualOutput >= minimumOutput;
}

/**
 * Calculates share of the pool when adding liquidity.
 *
 * When you deposit tokens into a liquidity pool, you receive "LP shares"
 * that represent your ownership percentage of the pool.
 *
 * Why shares?
 * - Multiple people deposit into the same pool
 * - We need to track who owns what portion
 * - Your shares give you the right to:
 *   1. Withdraw your proportional amount later
 *   2. Earn fees from swaps that happen in the pool
 *
 * How it works:
 * - First depositor: deposits (1000 ETH, 1000 USDC) → gets 1000 shares
 *   (arbitrary starting share amount, like taking square root of product)
 * - Second depositor: deposits (100 ETH, 100 USDC) in 1:1 ratio → gets 100 shares
 *   (proportional to first depositor)
 * - If pool has 1100 ETH, 1100 USDC, and 1100 total shares:
 *   Each share represents 1 ETH + 1 USDC of value
 *
 * Formula for new depositor:
 * - If you deposit ETH amount and USDC amount in the correct ratio,
 *   shares = min(ETH amount / ETH balance, USDC amount / USDC balance) * total shares
 * - This ensures you only get shares proportional to what you deposit
 *
 * @param ethAmount - Amount of ETH being deposited
 * @param usdcAmount - Amount of USDC being deposited
 * @param ethReserve - Current ETH balance in pool
 * @param usdcReserve - Current USDC balance in pool
 * @param totalShares - Total shares already issued
 * @returns New shares earned by this deposit
 */
export function calculateLiquidityShares(
  ethAmount: number,
  usdcAmount: number,
  ethReserve: number,
  usdcReserve: number,
  totalShares: number
): number {
  // Handle first liquidity deposit: create initial shares = sqrt(ETH * USDC)
  // This prevents share dilution attacks and provides reasonable initial share amount
  if (totalShares === 0) {
    const shares = Math.sqrt(ethAmount * usdcAmount);
    return Math.max(shares, 1000); // Ensure minimum shares for numerical stability
  }

  // For subsequent deposits: maintain proportional ownership
  // Calculate what fraction of the pool this deposit represents
  const ethFraction = ethAmount / ethReserve;
  const usdcFraction = usdcAmount / usdcReserve;

  // Use the minimum fraction to ensure deposit is properly proportioned
  // (you can't add 100 ETH to a 50 ETH pool expecting full credit unless USDC also grows)
  const fractionOfPool = Math.min(ethFraction, usdcFraction);

  // Shares earned = your fraction * total existing shares
  const sharesEarned = fractionOfPool * totalShares;

  return sharesEarned;
}

/**
 * Calculates tokens received when withdrawing liquidity.
 *
 * When you burn LP shares, you get back your proportional amount of
 * both tokens in the pool, plus any fees earned.
 *
 * Why it works this way:
 * - You own a percentage of the pool (shares / total shares)
 * - You get that same percentage of both tokens
 * - Fees from swaps accumulate in the pool, so you get more than you deposited
 *
 * Example:
 * - Pool has 1100 ETH, 1100 USDC, you own 100 of 1100 shares
 * - Your ownership = 100 / 1100 ≈ 9.09%
 * - You get 1100 * 0.0909 ≈ 100 ETH and 1100 * 0.0909 ≈ 100 USDC
 * - If pool earned fees, you'd get slightly more ETH and USDC
 *
 * @param sharesBurned - Number of LP shares being redeemed
 * @param ethReserve - Current ETH balance in pool
 * @param usdcReserve - Current USDC balance in pool
 * @param totalShares - Total shares in existence
 * @returns { ethAmount: ETH received, usdcAmount: USDC received }
 */
export function calculateWithdrawalAmounts(
  sharesBurned: number,
  ethReserve: number,
  usdcReserve: number,
  totalShares: number
): { ethAmount: number; usdcAmount: number } {
  // Calculate your ownership percentage
  const ownershipFraction = sharesBurned / totalShares;

  // You receive your fraction of both reserves
  const ethAmount = ethReserve * ownershipFraction;
  const usdcAmount = usdcReserve * ownershipFraction;

  return { ethAmount, usdcAmount };
}

/**
 * Calculates the current spot price in the pool.
 *
 * Spot price is the current price at which a small swap would execute.
 *
 * Formula: spotPrice = outputReserve / inputReserve
 *
 * Why this formula?
 * - Mathematically derived from the constant product formula
 * - As reserves change, the spot price adjusts accordingly
 * - This is how AMMs maintain price equilibrium with external markets
 *
 * Example:
 * - Pool has 1000 ETH and 2000 USDC
 * - Spot price = 2000 / 1000 = 2 USDC per ETH
 * - This means a small swap would get ~2 USDC for 1 ETH
 * - This price updates with every swap as reserves change
 *
 * @param usdcReserve - USDC balance in pool
 * @param ethReserve - ETH balance in pool
 * @returns Price of ETH in USDC (e.g., 2 means 1 ETH = 2 USDC)
 */
export function calculateSpotPrice(usdcReserve: number, ethReserve: number): number {
  if (ethReserve === 0) {
    throw new Error('Cannot calculate price with zero ETH reserve');
  }

  return usdcReserve / ethReserve;
}
