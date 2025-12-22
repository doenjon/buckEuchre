/**
 * Browser automation test for bot addition race condition
 * 
 * This test actually clicks buttons in a browser to reproduce the bug:
 * 1. Navigate to app
 * 2. Create game (click button)
 * 3. Add 3 bots (click button 3 times)
 * 4. Verify game starts without crashing
 */

const puppeteer = require('puppeteer');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

async function waitFor(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testBotAddition() {
  console.log('='.repeat(60));
  console.log('BROWSER TEST: Bot Addition Race Condition');
  console.log('='.repeat(60));
  console.log(`Frontend: ${FRONTEND_URL}`);
  console.log(`Backend: ${BACKEND_URL}`);
  console.log('');

  const browser = await puppeteer.launch({
    headless: false, // Show browser so you can see what's happening
    slowMo: 100, // Slow down by 100ms to see actions
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 720 });

    // Listen for console messages
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        console.error(`[BROWSER ERROR] ${text}`);
      } else if (text.includes('TEST') || text.includes('ERROR') || text.includes('CRASH')) {
        console.log(`[BROWSER] ${text}`);
      }
    });

    // Listen for page errors
    page.on('pageerror', error => {
      console.error(`[PAGE ERROR] ${error.message}`);
    });

    console.log('[TEST] Step 1: Navigating to frontend...');
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    await waitFor(1000);

    console.log('[TEST] Step 2: Clicking "Continue as Guest"...');
    const guestButton = await page.waitForSelector('button:has-text("Continue as Guest")', { timeout: 10000 });
    await guestButton.click();
    await waitFor(2000);

    console.log('[TEST] Step 3: Clicking "Create new game"...');
    const createButton = await page.waitForSelector('button:has-text("Create new game"), button:has-text("Create")', { timeout: 10000 });
    await createButton.click();
    await waitFor(2000);

    // Wait for game page to load
    console.log('[TEST] Step 4: Waiting for game page to load...');
    await page.waitForSelector('text=Waiting for', { timeout: 10000 });
    await waitFor(1000);

    // Get the current URL to extract gameId
    const url = page.url();
    const gameIdMatch = url.match(/\/game\/([^\/]+)/);
    if (!gameIdMatch) {
      throw new Error('Could not extract gameId from URL');
    }
    const gameId = gameIdMatch[1];
    console.log(`[TEST] Game ID: ${gameId}`);

    console.log('[TEST] Step 5: Clicking "Add AI players" button 3 times...');
    for (let i = 1; i <= 3; i++) {
      console.log(`[TEST] Adding bot ${i}/3...`);
      
      // Wait for button to be available (not disabled)
      const addAIButton = await page.waitForSelector('button:has-text("Add AI"), button:has-text("Add AI players")', { 
        timeout: 10000,
        visible: true
      });
      
      // Check if button is disabled
      const isDisabled = await page.evaluate(el => el.disabled, addAIButton);
      if (isDisabled) {
        console.log(`[TEST] Button is disabled, waiting...`);
        await waitFor(1000);
        continue;
      }

      await addAIButton.click();
      await waitFor(1500); // Wait between clicks
    }

    console.log('[TEST] Step 6: Monitoring for game start or errors...');
    
    // Wait up to 15 seconds for game to start
    let gameStarted = false;
    let errorOccurred = false;
    const startTime = Date.now();
    const timeout = 15000;

    while (Date.now() - startTime < timeout) {
      // Check for error messages
      const errorElement = await page.$('text=/error/i, text=/failed/i, text=/crash/i');
      if (errorElement) {
        const errorText = await page.evaluate(el => el.textContent, errorElement);
        console.error(`[TEST] ✗ Error detected: ${errorText}`);
        errorOccurred = true;
        break;
      }

      // Check if game board is visible (game started)
      const gameBoard = await page.$('[class*="GameBoard"], [class*="game-board"], text=/Round/i, text=/Bidding/i');
      if (gameBoard) {
        console.log('[TEST] ✓ Game board detected - game started!');
        gameStarted = true;
        break;
      }

      // Check for "Finding your position" (stuck state)
      const stuckElement = await page.$('text=/Finding your position/i');
      if (stuckElement) {
        const stuckText = await page.evaluate(el => el.textContent, stuckElement);
        console.warn(`[TEST] ⚠ Stuck state detected: ${stuckText}`);
        // Continue monitoring
      }

      await waitFor(500);
    }

    // Final check
    const finalUrl = page.url();
    const finalGameId = finalUrl.match(/\/game\/([^\/]+)/)?.[1];
    
    console.log('');
    console.log('='.repeat(60));
    if (errorOccurred) {
      console.log('[TEST] ✗ TEST FAILED - Error occurred');
      console.log('='.repeat(60));
      
      // Take screenshot
      await page.screenshot({ path: 'test-failure.png', fullPage: true });
      console.log('[TEST] Screenshot saved to test-failure.png');
      
      process.exit(1);
    } else if (gameStarted) {
      console.log('[TEST] ✓ TEST PASSED - Game started successfully');
      console.log('='.repeat(60));
      
      // Take screenshot
      await page.screenshot({ path: 'test-success.png', fullPage: true });
      console.log('[TEST] Screenshot saved to test-success.png');
      
      process.exit(0);
    } else {
      console.log('[TEST] ✗ TEST FAILED - Game did not start within timeout');
      console.log('='.repeat(60));
      
      // Take screenshot
      await page.screenshot({ path: 'test-timeout.png', fullPage: true });
      console.log('[TEST] Screenshot saved to test-timeout.png');
      
      process.exit(1);
    }

  } catch (error) {
    console.error('[TEST] ✗ TEST FAILED WITH EXCEPTION:', error);
    console.error(error.stack);
    
    // Take screenshot on error
    try {
      await page.screenshot({ path: 'test-exception.png', fullPage: true });
      console.log('[TEST] Screenshot saved to test-exception.png');
    } catch (e) {
      // Ignore screenshot errors
    }
    
    process.exit(1);
  } finally {
    // Keep browser open for 3 seconds so you can see the result
    await waitFor(3000);
    await browser.close();
  }
}

// Run the test
testBotAddition().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

