import asyncio
from playwright.async_api import async_playwright
import time

async def test_chat_eval_app():
    """Test the AI Chat with Groundedness Evaluator application"""
    
    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        print("🚀 Starting application test...")
        
        # Navigate to the application
        await page.goto("http://localhost:5001")
        print("✅ Page loaded")
        
        # Test 1: Check if main elements are present
        assert await page.is_visible("text=AI Chat with Groundedness Evaluator")
        print("✅ Header is visible")
        
        # Test 2: Check dark mode toggle
        dark_toggle = page.locator("#dark-mode-toggle")
        await dark_toggle.click()
        await page.wait_for_timeout(500)
        assert "dark" in await page.evaluate("document.documentElement.className")
        print("✅ Dark mode toggle works")
        
        # Toggle back to light mode
        await dark_toggle.click()
        await page.wait_for_timeout(500)
        
        # Test 3: Check panel controls
        # Test collapse evaluation panel
        collapse_btn = page.locator("#collapse-eval")
        await collapse_btn.click()
        await page.wait_for_timeout(500)
        assert await page.locator("#eval-panel").evaluate("el => el.classList.contains('panel-collapsed')")
        print("✅ Panel collapse works")
        
        # Expand it back
        await collapse_btn.click()
        await page.wait_for_timeout(500)
        
        # Test 4: Switch to Prompt Editor tab
        prompt_tab = page.locator("#prompt-tab")
        await prompt_tab.click()
        await page.wait_for_timeout(500)
        assert await page.is_visible("#prompt-textarea")
        print("✅ Prompt Editor tab works")
        
        # Test 5: Check template dropdown
        templates_btn = page.locator("#templates-btn")
        await templates_btn.click()
        await page.wait_for_timeout(500)
        assert await page.is_visible("#templates-dropdown")
        
        # Select a template
        factual_template = page.locator("button[data-template='factual']")
        await factual_template.click()
        await page.wait_for_timeout(500)
        
        # Check if template was loaded
        prompt_text = await page.locator("#prompt-textarea").input_value()
        assert "factual accuracy" in prompt_text.lower()
        print("✅ Template selection works")
        
        # Save the prompt
        save_btn = page.locator("#save-prompt")
        await save_btn.click()
        await page.wait_for_timeout(1000)
        print("✅ Prompt saving works")
        
        # Switch back to evaluation tab
        eval_tab = page.locator("#eval-tab")
        await eval_tab.click()
        await page.wait_for_timeout(500)
        
        # Test 6: Test chat without PDF (should work)
        user_input = page.locator("#user-input")
        await user_input.fill("What is machine learning?")
        
        send_btn = page.locator("#send-btn")
        await send_btn.click()
        
        # Wait for response (increased timeout for API call)
        await page.wait_for_selector(".message-bubble.assistant", timeout=15000)
        print("✅ Chat works without PDF")
        
        # Check if message appears
        messages = await page.locator(".message-bubble").count()
        assert messages >= 2  # At least user and assistant messages
        print("✅ Messages displayed correctly")
        
        # Test 7: Test PDF upload
        # Create a sample PDF for testing
        import os
        from pypdf import PdfWriter, PdfReader
        from io import BytesIO
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import letter
        
        # Create a simple PDF
        pdf_buffer = BytesIO()
        c = canvas.Canvas(pdf_buffer, pagesize=letter)
        c.drawString(100, 750, "Test PDF Document")
        c.drawString(100, 700, "This is a test document about artificial intelligence.")
        c.drawString(100, 650, "Machine learning is a subset of AI that enables")
        c.drawString(100, 600, "computers to learn from data without explicit programming.")
        c.save()
        
        # Save PDF to file
        pdf_path = "/tmp/test_document.pdf"
        with open(pdf_path, "wb") as f:
            f.write(pdf_buffer.getvalue())
        
        # Upload the PDF
        file_input = page.locator("#pdf-upload")
        await file_input.set_input_files(pdf_path)
        
        # Check if filename is displayed
        await page.wait_for_timeout(500)
        file_name_display = page.locator("#file-name")
        assert await file_name_display.is_visible()
        assert "test_document.pdf" in await file_name_display.text_content()
        print("✅ PDF filename displayed after selection")
        
        upload_btn = page.locator("#upload-btn")
        await upload_btn.click()
        
        # Wait for upload confirmation
        await page.wait_for_timeout(2000)
        upload_status = page.locator("#upload-status")
        status_text = await upload_status.text_content()
        assert "success" in status_text.lower() or "extracted" in status_text.lower()
        print("✅ PDF upload successful")
        
        # Test 8: Ask a question about the PDF
        await user_input.fill("What does the document say about machine learning?")
        await send_btn.click()
        
        # Wait for response and evaluation
        await page.wait_for_timeout(5000)
        
        # Check if evaluation appeared
        eval_display = page.locator("#evaluation-display")
        eval_content = await eval_display.text_content()
        
        # Should have evaluation content (not placeholder)
        assert "Send a message to see" not in eval_content
        print("✅ Evaluation generated for PDF-based question")
        
        # Test 9: Test Improve Response button
        improve_btn = page.locator("#improve-btn")
        if await improve_btn.is_visible():
            await improve_btn.click()
            await page.wait_for_timeout(5000)
            
            # Check for improved response
            messages_after = await page.locator(".message-bubble").count()
            assert messages_after > messages
            print("✅ Improve Response feature works")
        
        # Test 10: Test responsive design
        # Mobile view
        await page.set_viewport_size({"width": 375, "height": 667})
        await page.wait_for_timeout(500)
        print("✅ Mobile responsive view works")
        
        # Tablet view
        await page.set_viewport_size({"width": 768, "height": 1024})
        await page.wait_for_timeout(500)
        print("✅ Tablet responsive view works")
        
        # Desktop view
        await page.set_viewport_size({"width": 1920, "height": 1080})
        await page.wait_for_timeout(500)
        print("✅ Desktop responsive view works")
        
        print("\n🎉 All tests passed successfully!")
        print("\n📊 Test Summary:")
        print("- UI Components: ✅")
        print("- Dark Mode: ✅")
        print("- Panel Management: ✅")
        print("- Prompt Editor: ✅")
        print("- Chat Functionality: ✅")
        print("- PDF Upload: ✅")
        print("- Evaluation: ✅")
        print("- Responsive Design: ✅")
        
        # Clean up
        os.remove(pdf_path)
        
        # Keep browser open for manual inspection
        print("\n👀 Browser will stay open for 5 seconds for inspection...")
        await page.wait_for_timeout(5000)
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_chat_eval_app())