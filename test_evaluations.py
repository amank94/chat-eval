import asyncio
from playwright.async_api import async_playwright

async def test_evaluation_display():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)  # Visual testing
        page = await browser.new_page()
        
        # Go to the app
        await page.goto("http://localhost:5002")
        
        print("1. Checking initial page load...")
        
        # Wait for page to load
        await page.wait_for_selector("#api-key-modal")
        
        # Check if API key modal is visible
        api_modal_visible = await page.is_visible("#api-key-modal")
        print(f"API Key modal visible: {api_modal_visible}")
        
        # If modal is visible, we need to add an API key
        if api_modal_visible:
            print("2. API key modal is open - need to add API key")
            print("   This explains why evaluations don't show - no valid API key!")
            
            # Check if user has a real API key set as environment variable for testing
            import os
            test_api_key = os.environ.get('ANTHROPIC_API_KEY')
            
            if test_api_key:
                print(f"   Found test API key, trying to use it...")
                await page.fill("#api-key-input", test_api_key)
                await page.click("#save-api-key")
                
                # Wait for validation
                await page.wait_for_timeout(3000)
                
                # Check if modal is now hidden
                api_modal_visible_after = await page.is_visible("#api-key-modal")
                print(f"   API key modal still visible after save: {api_modal_visible_after}")
            else:
                print("   No ANTHROPIC_API_KEY env var found, canceling modal")
                await page.click("#cancel-api-key")
            
        print("3. Checking right panel structure...")
        
        # Check if evaluation panel exists
        eval_panel_exists = await page.is_visible("#eval-panel")
        print(f"Evaluation panel exists: {eval_panel_exists}")
        
        # Check evaluation display area
        eval_display_exists = await page.is_visible("#evaluation-display")
        print(f"Evaluation display exists: {eval_display_exists}")
        
        # Check current content of evaluation display
        if eval_display_exists:
            eval_content = await page.inner_text("#evaluation-display")
            print(f"Current evaluation display content: {eval_content[:100]}...")
        
        # Test chat interaction
        print("4. Testing chat interaction...")
        
        # Check if API key modal is still visible (if so, can't chat)
        api_modal_still_visible = await page.is_visible("#api-key-modal")
        
        if not api_modal_still_visible:
            print("   API key set successfully, trying chat...")
            await page.fill("#user-input", "Hello, this is a test message")
            await page.click("#send-btn")
            
            # Wait for response
            print("   Waiting for chat response...")
            await page.wait_for_timeout(5000)
            
            # Check if any messages appeared in chat
            chat_messages = await page.locator("#chat-messages .message-bubble").count()
            print(f"   Number of chat messages: {chat_messages}")
            
            # Check evaluation area again
            if eval_display_exists:
                eval_content_after = await page.inner_text("#evaluation-display")
                print(f"   Evaluation content after chat: {eval_content_after[:100]}...")
                
                # Check if improve button appeared
                improve_btn_visible = await page.is_visible("#improve-btn")
                print(f"   Improve button visible: {improve_btn_visible}")
        else:
            print("   API key modal still visible, skipping chat test")
            chat_messages = 0
            eval_content_after = "No API key - can't test chat"
        
        # Take a screenshot for debugging
        await page.screenshot(path="evaluation_test_debug.png")
        print("Screenshot saved as evaluation_test_debug.png")
        
        # Let's also check the JavaScript console for errors
        console_messages = []
        page.on("console", lambda msg: console_messages.append(f"{msg.type}: {msg.text}"))
        
        # Wait a bit more to catch any console messages
        await page.wait_for_timeout(1000)
        
        print("5. Console messages:")
        for msg in console_messages[-5:]:  # Last 5 messages
            print(f"  {msg}")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_evaluation_display())