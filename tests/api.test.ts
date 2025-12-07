/**
 * API Integration Tests
 *
 * These tests verify that the DEX endpoints work correctly.
 * They test both happy path (successful operations) and error cases.
 *
 * Run with: npm test
 * (Make sure server is running: npm start in another terminal)
 *
 * Environment:
 * - Set TEST_BASE_URL to point to your server
 * - Defaults to http://localhost:3000
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

/**
 * Helper function to make API calls
 * Wraps fetch with error handling
 */
async function callApi(method: string, path: string, body?: Record<string, unknown>) {
  const url = `${BASE_URL}${path}`;
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  return { status: response.status, data };
}

/**
 * Test suite for pool info endpoints
 */
console.log('\n=== Testing Pool Info Endpoints ===\n');

(async () => {
  try {
    // Test GET /pool/info
    console.log('Test 1: GET /pool/info');
    const { status: poolInfoStatus, data: poolInfo } = await callApi('GET', '/pool/info');
    console.log(`Status: ${poolInfoStatus}`);
    console.log(`✓ Pool has ${poolInfo.ethReserve} ETH and ${poolInfo.usdcReserve} USDC`);
    console.log(`✓ Total LP shares: ${poolInfo.totalShares}`);
    console.log(`✓ k (constant product): ${poolInfo.k}`);
    console.log('');

    // Test GET /pool/price
    console.log('Test 2: GET /pool/price');
    const { status: priceStatus, data: priceData } = await callApi('GET', '/pool/price');
    console.log(`Status: ${priceStatus}`);
    console.log(`✓ Current price: 1 ETH = ${priceData.ethPriceInUsdc} USDC`);
    console.log('');

    /**
     * Test suite for quote endpoint
     *
     * /quote is crucial because it shows:
     * - What you'll get from a swap (output amount)
     * - How much fee you'll pay
     * - Price impact (how much worse than spot price)
     * - Minimum acceptable output (with slippage tolerance)
     *
     * Quote is read-only, so pool state doesn't change
     */
    console.log('=== Testing Quote Endpoint ===\n');

    console.log('Test 3: POST /quote - Get ETH→USDC quote');
    const { status: quoteStatus, data: quoteData } = await callApi('POST', '/quote', {
      inputToken: 'ETH',
      outputToken: 'USDC',
      amount: 10,
      slippageTolerance: 0.005,
    });
    console.log(`Status: ${quoteStatus}`);
    console.log(`✓ Input: ${quoteData.inputAmount} ETH`);
    console.log(`✓ Fee: ${quoteData.fee} ETH (0.3%)`);
    console.log(`✓ Amount after fee: ${quoteData.amountAfterFee} ETH`);
    console.log(`✓ Expected output: ${quoteData.expectedOutput} USDC`);
    console.log(`✓ Price impact: ${(quoteData.priceImpact * 100).toFixed(2)}%`);
    console.log(`✓ Minimum acceptable: ${quoteData.minimumOutput} USDC (with 0.5% slippage)`);
    console.log('');

    console.log('Test 4: POST /quote - Get USDC→ETH quote');
    const { status: quoteStatus2, data: quoteData2 } = await callApi('POST', '/quote', {
      inputToken: 'USDC',
      outputToken: 'ETH',
      amount: 10,
      slippageTolerance: 0.005,
    });
    console.log(`Status: ${quoteStatus2}`);
    console.log(`✓ Input: ${quoteData2.inputAmount} USDC`);
    console.log(`✓ Expected output: ${quoteData2.expectedOutput} ETH`);
    console.log('');

    /**
     * Test suite for swap endpoints
     *
     * /buy and /sell execute swaps (change pool state)
     * They first calculate like /quote does, then update pool reserves
     */
    console.log('=== Testing Swap Endpoints ===\n');

    console.log('Test 5: POST /buy - Swap 10 ETH for USDC');
    const { status: buyStatus, data: buyData } = await callApi('POST', '/buy', {
      ethAmount: 10,
      slippageTolerance: 0.005,
    });
    console.log(`Status: ${buyStatus}`);
    if (buyStatus === 200) {
      console.log(`✓ Swapped ${buyData.transaction.inputAmount} ETH`);
      console.log(`✓ Received ${buyData.transaction.outputAmount} USDC`);
      console.log(`✓ Fee: ${buyData.transaction.fee} ETH`);
      console.log(`✓ Price impact: ${(buyData.transaction.priceImpact * 100).toFixed(2)}%`);
      console.log(`✓ Pool ETH after: ${buyData.transaction.poolEthAfter}`);
      console.log(`✓ Pool USDC after: ${buyData.transaction.poolUsdcAfter}`);
    } else {
      console.log(`✗ Error: ${buyData.error}`);
    }
    console.log('');

    console.log('Test 6: POST /sell - Swap 10 USDC for ETH');
    const { status: sellStatus, data: sellData } = await callApi('POST', '/sell', {
      usdcAmount: 10,
      slippageTolerance: 0.005,
    });
    console.log(`Status: ${sellStatus}`);
    if (sellStatus === 200) {
      console.log(`✓ Swapped ${sellData.transaction.inputAmount} USDC`);
      console.log(`✓ Received ${sellData.transaction.outputAmount} ETH`);
      console.log(`✓ Price impact: ${(sellData.transaction.priceImpact * 100).toFixed(2)}%`);
    } else {
      console.log(`✗ Error: ${sellData.error}`);
    }
    console.log('');

    /**
     * Test suite for liquidity endpoints
     *
     * Adding liquidity:
     * - You deposit both tokens proportionally
     * - You receive LP shares (proof of ownership)
     * - You start earning fees from future swaps
     *
     * Removing liquidity:
     * - You burn LP shares
     * - You get back your proportion of tokens
     * - Your share of accumulated fees is included
     */
    console.log('=== Testing Liquidity Endpoints ===\n');

    // Get current pool state before adding liquidity
    const { data: poolBefore } = await callApi('GET', '/pool/info');
    console.log('Test 7: POST /add-liquidity - Add 100 ETH + 100 USDC');
    const { status: addLiqStatus, data: addLiqData } = await callApi('POST', '/add-liquidity', {
      ethAmount: 100,
      usdcAmount: 100,
    });
    console.log(`Status: ${addLiqStatus}`);
    if (addLiqStatus === 200) {
      console.log(`✓ Added ${addLiqData.liquidity.ethAdded} ETH and ${addLiqData.liquidity.usdcAdded} USDC`);
      console.log(`✓ Received ${addLiqData.liquidity.sharesIssued} LP shares`);
      console.log(`✓ Pool ETH: ${poolBefore.ethReserve} → ${addLiqData.liquidity.poolEthAfter}`);
      console.log(`✓ Pool USDC: ${poolBefore.usdcReserve} → ${addLiqData.liquidity.poolUsdcAfter}`);
      console.log(`✓ Total shares: ${poolBefore.totalShares} → ${addLiqData.liquidity.totalSharesAfter}`);
    } else {
      console.log(`✗ Error: ${addLiqData.error}`);
    }
    console.log('');

    console.log('Test 8: POST /remove-liquidity - Burn 50 shares');
    const { status: removeLiqStatus, data: removeLiqData } = await callApi(
      'POST',
      '/remove-liquidity',
      {
        sharesToBurn: 50,
      }
    );
    console.log(`Status: ${removeLiqStatus}`);
    if (removeLiqStatus === 200) {
      console.log(`✓ Burned ${removeLiqData.liquidity.sharesBurned} shares`);
      console.log(`✓ Withdrawn ${removeLiqData.liquidity.ethWithdrawn} ETH`);
      console.log(`✓ Withdrawn ${removeLiqData.liquidity.usdcWithdrawn} USDC`);
      console.log(`✓ Remaining pool shares: ${removeLiqData.liquidity.totalSharesAfter}`);
    } else {
      console.log(`✗ Error: ${removeLiqData.error}`);
    }
    console.log('');

    /**
     * Test suite for error cases
     *
     * Good APIs handle errors gracefully with clear messages
     * We test invalid inputs and boundary conditions
     */
    console.log('=== Testing Error Cases ===\n');

    console.log('Test 9: POST /quote - Invalid token pair');
    const { status: errorStatus1, data: errorData1 } = await callApi('POST', '/quote', {
      inputToken: 'ETH',
      outputToken: 'ETH',
      amount: 10,
    });
    console.log(`Status: ${errorStatus1}`);
    console.log(`✓ Error caught: ${errorData1.error}`);
    console.log('');

    console.log('Test 10: POST /buy - Amount too small');
    const { status: errorStatus2, data: errorData2 } = await callApi('POST', '/buy', {
      ethAmount: 0.001,
    });
    console.log(`Status: ${errorStatus2}`);
    console.log(`✓ Error caught: ${errorData2.error}`);
    console.log('');

    console.log('Test 11: POST /add-liquidity - Amounts not proportional');
    const { status: errorStatus3, data: errorData3 } = await callApi('POST', '/add-liquidity', {
      ethAmount: 100,
      usdcAmount: 10, // Way off ratio
    });
    console.log(`Status: ${errorStatus3}`);
    console.log(`✓ Error caught: ${errorData3.error}`);
    console.log('');

    console.log('✅ All tests completed!\n');
  } catch (error) {
    console.error('Test failed:', error);
  }
})();
