"""Smart Checkbox & Dropdown Handling."""
import asyncio
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class SmartCheckbox:
    """Intelligent checkbox interaction."""
    
    def __init__(self, page):
        self.page = page
    
    async def set_checked(self, selector: str, should_be_checked: bool) -> bool:
        """
        Set checkbox to desired state intelligently.
        Returns: True if successful, False otherwise
        """
        try:
            # Find the checkbox
            checkbox = self.page.locator(selector).first
            
            # Wait for it to be available
            await checkbox.wait_for(state="visible", timeout=5000)
            
            # Check if it's disabled
            is_disabled = await checkbox.is_disabled()
            if is_disabled:
                logger.warning(f"Checkbox is disabled: {selector}")
                return False
            
            # Get current state
            is_currently_checked = await checkbox.is_checked()
            
            # Already in desired state?
            if is_currently_checked == should_be_checked:
                logger.info(f"Checkbox already in desired state: {should_be_checked}")
                return True
            
            # Need to toggle - try clicking
            await checkbox.click(timeout=3000)
            await asyncio.sleep(0.3)
            
            # Verify state changed
            new_state = await checkbox.is_checked()
            if new_state == should_be_checked:
                logger.info(f"Checkbox set to {should_be_checked} successfully")
                return True
            
            # State didn't change - try alternatives
            logger.warning("Click didn't change state - trying alternatives")
            
            # Alternative 1: Click the label
            try:
                label = self.page.locator(f"label[for='{selector.strip('#')}']").first
                if await label.count() > 0:
                    await label.click(timeout=2000)
                    await asyncio.sleep(0.3)
                    new_state = await checkbox.is_checked()
                    if new_state == should_be_checked:
                        logger.info("Checkbox set via label click")
                        return True
            except Exception:
                pass
            
            # Alternative 2: Use Space key
            try:
                await checkbox.focus()
                await self.page.keyboard.press("Space")
                await asyncio.sleep(0.3)
                new_state = await checkbox.is_checked()
                if new_state == should_be_checked:
                    logger.info("Checkbox set via Space key")
                    return True
            except Exception:
                pass
            
            # Alternative 3: JavaScript
            try:
                await checkbox.evaluate(f"el => el.checked = {str(should_be_checked).lower()}")
                await checkbox.evaluate("el => el.dispatchEvent(new Event('change', { bubbles: true }))")
                await asyncio.sleep(0.3)
                new_state = await checkbox.is_checked()
                if new_state == should_be_checked:
                    logger.info("Checkbox set via JavaScript")
                    return True
            except Exception:
                pass
            
            logger.error(f"Failed to set checkbox to {should_be_checked}")
            return False
        
        except Exception as e:
            logger.error(f"Checkbox error: {e}")
            return False


class SmartDropdown:
    """Intelligent dropdown/select handling."""
    
    def __init__(self, page):
        self.page = page
    
    async def select_option(self, selector: str, option_text: str) -> bool:
        """
        Select option from dropdown intelligently.
        Returns: True if successful
        """
        try:
            dropdown = self.page.locator(selector).first
            
            # Wait for dropdown to be ready
            await dropdown.wait_for(state="visible", timeout=5000)
            
            # Check if it's a native select
            tag_name = await dropdown.evaluate("el => el.tagName")
            
            if tag_name.lower() == "select":
                # Native select - use select_option
                await dropdown.select_option(label=option_text, timeout=3000)
                await asyncio.sleep(0.3)
                logger.info(f"Selected option: {option_text}")
                return True
            else:
                # Custom dropdown - need to click and select
                return await self._handle_custom_dropdown(dropdown, option_text)
        
        except Exception as e:
            logger.error(f"Dropdown select error: {e}")
            return False
    
    async def _handle_custom_dropdown(self, dropdown, option_text: str) -> bool:
        """Handle custom dropdowns (not native <select>)."""
        try:
            # Click to open
            await dropdown.click(timeout=3000)
            await asyncio.sleep(0.5)
            
            # Wait for options to appear
            await self.page.wait_for_timeout(500)
            
            # Try to find and click the option
            option_selectors = [
                f"[role='option']:has-text('{option_text}')",
                f"li:has-text('{option_text}')",
                f"div:has-text('{option_text}')",
                f"button:has-text('{option_text}')",
            ]
            
            for sel in option_selectors:
                try:
                    option = self.page.locator(sel).first
                    if await option.count() > 0 and await option.is_visible():
                        await option.click(timeout=2000)
                        await asyncio.sleep(0.3)
                        logger.info(f"Selected custom dropdown option: {option_text}")
                        return True
                except Exception:
                    continue
            
            logger.warning(f"Could not find option: {option_text}")
            return False
        
        except Exception as e:
            logger.error(f"Custom dropdown error: {e}")
            return False
