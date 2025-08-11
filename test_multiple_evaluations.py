#!/usr/bin/env python3

import asyncio
from playwright.async_api import async_playwright
import os

async def test_multiple_evaluations():
    """Test multiple evaluation criteria functionality"""
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        print("1. Loading the application...")
        await page.goto("http://localhost:5002")
        
        # Wait for page load
        await page.wait_for_selector("#api-key-modal")
        
        # Check if API key modal is visible
        api_modal_visible = await page.is_visible("#api-key-modal")
        
        if api_modal_visible:
            print("2. API key modal is visible - need to add an API key to test")
            
            # Check for test API key
            test_api_key = os.environ.get('ANTHROPIC_API_KEY')
            
            if test_api_key:
                print("   Adding test API key...")
                await page.fill("#api-key-input", test_api_key)
                await page.click("#save-api-key")
                await page.wait_for_timeout(3000)
                
                api_modal_still_visible = await page.is_visible("#api-key-modal")
                if api_modal_still_visible:
                    print("   API key validation failed, skipping test")
                    await browser.close()
                    return
                    
                print("   ✅ API key validated successfully!")
            else:
                print("   No ANTHROPIC_API_KEY environment variable found")
                print("   ❌ Cannot test evaluations without valid API key")
                await browser.close()
                return
        
        print("3. Checking evaluation checkboxes...")
        
        # Check that all checkboxes exist
        checkboxes = [
            'eval-groundedness',
            'eval-factual', 
            'eval-completeness',
            'eval-relevance'
        ]
        
        for checkbox_id in checkboxes:
            checkbox_exists = await page.is_visible(f"#{checkbox_id}")
            print(f"   {checkbox_id}: {'✅' if checkbox_exists else '❌'}")
        
        print("4. Selecting multiple evaluation criteria...")
        
        # Make sure groundedness is checked (default)
        await page.check("#eval-groundedness")
        
        # Also check factual accuracy and completeness
        await page.check("#eval-factual")
        await page.check("#eval-completeness")
        
        # Verify they are checked
        groundedness_checked = await page.is_checked("#eval-groundedness")
        factual_checked = await page.is_checked("#eval-factual")
        completeness_checked = await page.is_checked("#eval-completeness")
        relevance_checked = await page.is_checked("#eval-relevance")
        
        print(f"   Selected criteria:")
        print(f"   - Groundedness: {'✅' if groundedness_checked else '❌'}")
        print(f"   - Factual Accuracy: {'✅' if factual_checked else '❌'}")  
        print(f"   - Completeness: {'✅' if completeness_checked else '❌'}")
        print(f"   - Relevance: {'✅' if relevance_checked else '❌'}")
        
        print("5. Uploading a sample PDF...")
        
        # For testing, we'll skip PDF upload and just test without it
        # This will still test the multiple evaluation checkbox functionality
        
        print("6. Testing chat with multiple evaluation criteria...")
        
        await page.fill("#user-input", "Hello, this is a test message for multiple evaluations")
        await page.click("#send-btn")
        
        print("   Waiting for response and evaluations...")
        await page.wait_for_timeout(8000)
        
        # Check if evaluations appeared
        eval_display = await page.locator("#evaluation-display").inner_text()
        
        print(f"7. Evaluation display content preview:")
        print(f"   {eval_display[:200]}...")
        
        # Check if improve button appeared
        improve_btn_visible = await page.is_visible("#improve-btn")
        print(f"   Improve button visible: {'✅' if improve_btn_visible else '❌'}")
        
        # Take screenshot for debugging
        await page.screenshot(path="multiple_evaluations_test.png")
        print("8. Screenshot saved as multiple_evaluations_test.png")
        
        print("9. Test completed!")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_multiple_evaluations())