"""Universal Smart Interaction Engine - Handles ALL UI elements intelligently."""
import asyncio
import re
from typing import Optional, Tuple, Any, List
import logging

logger = logging.getLogger(__name__)


class SmartInteractionEngine:
    """Master class for all element interactions with state verification."""
    
    def __init__(self, page):
        self.page = page
        self.default_timeout = 5000
    
    # ═══════════════════════════════════════════════════════════════
    # CHECKBOXES
    # ═══════════════════════════════════════════════════════════════
    
    async def set_checkbox(self, selector: str, should_be_checked: bool) -> Tuple[bool, str]:
        """
        Set checkbox to desired state with verification.
        Returns: (success, message)
        """
        try:
            checkbox = self.page.locator(selector).first
            await checkbox.wait_for(state="visible", timeout=self.default_timeout)
            
            # Check if disabled
            if await checkbox.is_disabled():
                return (False, f"Checkbox is disabled: {selector}")
            
            # Get current state
            current_state = await checkbox.is_checked()
            logger.info(f"Checkbox current state: {current_state}, desired: {should_be_checked}")
            
            # Already in desired state?
            if current_state == should_be_checked:
                return (True, f"Checkbox already {should_be_checked}")
            
            # Need to toggle - try multiple strategies
            strategies = [
                self._checkbox_click,
                self._checkbox_label_click,
                self._checkbox_space_key,
                self._checkbox_javascript,
            ]
            
            for strategy in strategies:
                try:
                    await strategy(checkbox, selector)
                    await asyncio.sleep(0.3)
                    
                    # Verify state changed
                    new_state = await checkbox.is_checked()
                    if new_state == should_be_checked:
                        logger.info(f"Checkbox set to {should_be_checked} via {strategy.__name__}")
                        return (True, f"Checkbox set to {should_be_checked}")
                except Exception as e:
                    logger.debug(f"Strategy {strategy.__name__} failed: {e}")
                    continue
            
            return (False, f"Failed to set checkbox to {should_be_checked}")
        
        except Exception as e:
            return (False, f"Checkbox error: {str(e)}")
    
    async def _checkbox_click(self, checkbox, selector):
        await checkbox.click(timeout=2000)
    
    async def _checkbox_label_click(self, checkbox, selector):
        checkbox_id = await checkbox.get_attribute("id")
        if checkbox_id:
            label = self.page.locator(f"label[for='{checkbox_id}']").first
            if await label.count() > 0:
                await label.click(timeout=2000)
    
    async def _checkbox_space_key(self, checkbox, selector):
        await checkbox.focus()
        await self.page.keyboard.press("Space")
    
    async def _checkbox_javascript(self, checkbox, selector):
        is_checked = await checkbox.is_checked()
        await checkbox.evaluate(f"el => el.checked = {str(not is_checked).lower()}")
        await checkbox.evaluate("el => el.dispatchEvent(new Event('change', { bubbles: true }))")
    
    # ═══════════════════════════════════════════════════════════════
    # RADIO BUTTONS
    # ═══════════════════════════════════════════════════════════════
    
    async def select_radio(self, selector: str) -> Tuple[bool, str]:
        """
        Select radio button with verification.
        Returns: (success, message)
        """
        try:
            radio = self.page.locator(selector).first
            await radio.wait_for(state="visible", timeout=self.default_timeout)
            
            if await radio.is_disabled():
                return (False, "Radio button is disabled")
            
            # Already selected?
            if await radio.is_checked():
                return (True, "Radio already selected")
            
            # Try to select
            await radio.click(timeout=3000)
            await asyncio.sleep(0.3)
            
            # Verify
            if await radio.is_checked():
                return (True, "Radio button selected")
            
            # Fallback: label click
            radio_id = await radio.get_attribute("id")
            if radio_id:
                label = self.page.locator(f"label[for='{radio_id}']").first
                if await label.count() > 0:
                    await label.click(timeout=2000)
                    await asyncio.sleep(0.3)
                    if await radio.is_checked():
                        return (True, "Radio selected via label")
            
            return (False, "Failed to select radio button")
        
        except Exception as e:
            return (False, f"Radio error: {str(e)}")
    
    # ═══════════════════════════════════════════════════════════════
    # DROPDOWNS / SELECTS
    # ═══════════════════════════════════════════════════════════════
    
    async def select_dropdown(self, selector: str, option_text: str) -> Tuple[bool, str]:
        """
        Select from dropdown (native or custom) with verification.
        Returns: (success, message)
        """
        try:
            dropdown = self.page.locator(selector).first
            await dropdown.wait_for(state="visible", timeout=self.default_timeout)
            
            # Detect type
            tag_name = await dropdown.evaluate("el => el.tagName")
            
            if tag_name.lower() == "select":
                # Native select
                await dropdown.select_option(label=option_text, timeout=3000)
                await asyncio.sleep(0.3)
                
                # Verify
                selected_text = await dropdown.evaluate(
                    "el => el.options[el.selectedIndex].text"
                )
                if option_text.lower() in selected_text.lower():
                    return (True, f"Selected: {option_text}")
                return (False, f"Selected {selected_text} instead of {option_text}")
            else:
                # Custom dropdown
                return await self._select_custom_dropdown(dropdown, option_text)
        
        except Exception as e:
            return (False, f"Dropdown error: {str(e)}")
    
    async def _select_custom_dropdown(self, dropdown, option_text: str) -> Tuple[bool, str]:
        """Handle custom dropdowns."""
        try:
            # Click to open
            await dropdown.click(timeout=3000)
            await asyncio.sleep(0.5)
            
            # Try different option selectors
            option_selectors = [
                f"[role='option']:has-text('{option_text}')",
                f"li:has-text('{option_text}')",
                f"div:has-text('{option_text}')",
                f"button:has-text('{option_text}')",
                f"a:has-text('{option_text}')",
            ]
            
            for sel in option_selectors:
                try:
                    option = self.page.locator(sel).first
                    if await option.count() > 0 and await option.is_visible():
                        await option.click(timeout=2000)
                        await asyncio.sleep(0.3)
                        logger.info(f"Selected custom dropdown option: {option_text}")
                        return (True, f"Selected: {option_text}")
                except Exception:
                    continue
            
            return (False, f"Could not find option: {option_text}")
        
        except Exception as e:
            return (False, f"Custom dropdown error: {str(e)}")
    
    # ═══════════════════════════════════════════════════════════════
    # FORMS
    # ═══════════════════════════════════════════════════════════════
    
    async def fill_form_field(self, selector: str, value: str, clear_first: bool = True) -> Tuple[bool, str]:
        """
        Fill form field with verification.
        Returns: (success, message)
        """
        try:
            field = self.page.locator(selector).first
            await field.wait_for(state="visible", timeout=self.default_timeout)
            
            if await field.is_disabled():
                return (False, "Field is disabled")
            
            # Clear if needed
            if clear_first:
                await field.clear(timeout=2000)
                await asyncio.sleep(0.1)
            
            # Fill
            await field.fill(value, timeout=3000)
            await asyncio.sleep(0.2)
            
            # Verify
            actual_value = await field.input_value()
            if actual_value == value:
                return (True, f"Field filled with: {value}")
            
            # Fallback: type character by character
            await field.clear()
            await field.type(value, delay=50)
            await asyncio.sleep(0.2)
            
            actual_value = await field.input_value()
            if actual_value == value:
                return (True, f"Field filled via typing: {value}")
            
            return (False, f"Field has '{actual_value}' instead of '{value}'")
        
        except Exception as e:
            return (False, f"Form field error: {str(e)}")
    
    # ═══════════════════════════════════════════════════════════════
    # BUTTONS
    # ═══════════════════════════════════════════════════════════════
    
    async def click_button(self, selector: str, wait_for_navigation: bool = False) -> Tuple[bool, str]:
        """
        Click button with multiple fallback strategies.
        Returns: (success, message)
        """
        try:
            button = self.page.locator(selector).first
            await button.wait_for(state="visible", timeout=self.default_timeout)
            
            if await button.is_disabled():
                return (False, "Button is disabled")
            
            # Strategy 1: Normal click
            try:
                if wait_for_navigation:
                    async with self.page.expect_navigation(timeout=10000):
                        await button.click(timeout=3000)
                else:
                    await button.click(timeout=3000)
                return (True, "Button clicked")
            except Exception:
                pass
            
            # Strategy 2: Force click (bypass overlays)
            try:
                await button.click(force=True, timeout=2000)
                return (True, "Button force-clicked")
            except Exception:
                pass
            
            # Strategy 3: JavaScript click
            try:
                await button.evaluate("el => el.click()")
                await asyncio.sleep(0.3)
                return (True, "Button clicked via JavaScript")
            except Exception:
                pass
            
            # Strategy 4: Focus + Enter
            try:
                await button.focus()
                await self.page.keyboard.press("Enter")
                await asyncio.sleep(0.3)
                return (True, "Button activated via Enter key")
            except Exception:
                pass
            
            return (False, "All click strategies failed")
        
        except Exception as e:
            return (False, f"Button click error: {str(e)}")
    
    # ═══════════════════════════════════════════════════════════════
    # VERIFICATION / ASSERTIONS
    # ═══════════════════════════════════════════════════════════════
    
    async def verify_text_present(self, expected_text: str, selector: str = "body") -> Tuple[bool, str]:
        """
        Verify text is present on page.
        Returns: (success, message)
        """
        try:
            # Wait for text to appear
            try:
                await self.page.wait_for_selector(
                    f"text={expected_text}",
                    state="visible",
                    timeout=5000
                )
                return (True, f"Text '{expected_text}' found")
            except Exception:
                pass
            
            # Check in specific element
            element = self.page.locator(selector).first
            if await element.count() > 0:
                text_content = await element.text_content()
                if expected_text.lower() in text_content.lower():
                    return (True, f"Text '{expected_text}' found in {selector}")
                return (False, f"Expected '{expected_text}' but found: {text_content[:100]}")
            
            # Check entire page
            page_text = await self.page.text_content("body")
            if expected_text.lower() in page_text.lower():
                return (True, f"Text '{expected_text}' found on page")
            
            return (False, f"Text '{expected_text}' not found anywhere")
        
        except Exception as e:
            return (False, f"Verification error: {str(e)}")
    
    async def verify_element_state(self, selector: str, expected_state: str) -> Tuple[bool, str]:
        """
        Verify element state (visible, hidden, checked, enabled, disabled).
        Returns: (success, message)
        """
        try:
            element = self.page.locator(selector).first
            
            if expected_state == "visible":
                is_visible = await element.is_visible()
                return (is_visible, f"Element {selector} is {'visible' if is_visible else 'not visible'}")
            
            elif expected_state == "hidden":
                is_hidden = not await element.is_visible()
                return (is_hidden, f"Element {selector} is {'hidden' if is_hidden else 'visible'}")
            
            elif expected_state == "checked":
                is_checked = await element.is_checked()
                return (is_checked, f"Element {selector} is {'checked' if is_checked else 'unchecked'}")
            
            elif expected_state == "unchecked":
                is_unchecked = not await element.is_checked()
                return (is_unchecked, f"Element {selector} is {'unchecked' if is_unchecked else 'checked'}")
            
            elif expected_state == "enabled":
                is_enabled = not await element.is_disabled()
                return (is_enabled, f"Element {selector} is {'enabled' if is_enabled else 'disabled'}")
            
            elif expected_state == "disabled":
                is_disabled = await element.is_disabled()
                return (is_disabled, f"Element {selector} is {'disabled' if is_disabled else 'enabled'}")
            
            return (False, f"Unknown state: {expected_state}")
        
        except Exception as e:
            return (False, f"State verification error: {str(e)}")
    
    # ═══════════════════════════════════════════════════════════════
    # SORTING & FILTERING
    # ═══════════════════════════════════════════════════════════════
    
    async def apply_sort(self, sort_selector: str, option: str) -> Tuple[bool, str]:
        """
        Apply sorting and wait for results to update.
        Returns: (success, message)
        """
        try:
            # Get initial content
            initial_content = await self.page.text_content("body")
            
            # Apply sort
            success, msg = await self.select_dropdown(sort_selector, option)
            if not success:
                return (False, msg)
            
            # Wait for content to change (results updated)
            for i in range(10):  # Max 5 seconds
                await asyncio.sleep(0.5)
                new_content = await self.page.text_content("body")
                if new_content != initial_content:
                    # Wait for loading to complete
                    await self._wait_for_loading_complete()
                    return (True, f"Sort applied: {option}")
            
            return (True, f"Sort applied but no visible change")
        
        except Exception as e:
            return (False, f"Sort error: {str(e)}")
    
    async def _wait_for_loading_complete(self, timeout: int = 10000):
        """Wait for loading indicators to disappear."""
        loading_selectors = [
            "[class*='loading']",
            "[class*='spinner']",
            "[class*='skeleton']",
            "[aria-busy='true']",
        ]
        
        for selector in loading_selectors:
            try:
                await self.page.wait_for_selector(
                    selector,
                    state="hidden",
                    timeout=timeout
                )
            except Exception:
                pass
        
        # Wait for network to be idle
        try:
            await self.page.wait_for_load_state("networkidle", timeout=timeout)
        except Exception:
            pass
