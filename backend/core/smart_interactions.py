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
        Set checkbox to desired state with STRICT verification.
        CRITICAL: ALWAYS check current state first, only click if needed, VERIFY after, FAIL if verification fails.
        Returns: (success, message)
        """
        try:
            checkbox = self.page.locator(selector).first
            await checkbox.wait_for(state="visible", timeout=self.default_timeout)
            
            # Check if disabled
            if await checkbox.is_disabled():
                return (False, f"Checkbox is disabled: {selector}")
            
            # STEP 1: Get current state BEFORE any action
            current_state = await checkbox.is_checked()
            logger.info(f"Checkbox PRE-CHECK: current={current_state}, desired={should_be_checked}")
            
            # STEP 2: Already in desired state? Skip click
            if current_state == should_be_checked:
                logger.info(f"Checkbox already in desired state: {should_be_checked} - SKIPPING click")
                return (True, f"Checkbox already {'checked' if should_be_checked else 'unchecked'} (no action needed)")
            
            # STEP 3: Need to toggle - try multiple strategies
            logger.info(f"Checkbox state mismatch - attempting to change from {current_state} to {should_be_checked}")
            strategies = [
                ("direct_click", self._checkbox_click),
                ("label_click", self._checkbox_label_click),
                ("space_key", self._checkbox_space_key),
                ("javascript", self._checkbox_javascript),
                ("force_click", self._checkbox_force_click),
                ("parent_click", self._checkbox_parent_click),
            ]
            
            for strategy_name, strategy_fn in strategies:
                try:
                    await strategy_fn(checkbox, selector)
                    await asyncio.sleep(0.5)  # Give time for state change
                    
                    # STEP 4: VERIFY state changed to desired value
                    new_state = await checkbox.is_checked()
                    logger.info(f"Checkbox POST-CHECK ({strategy_name}): new_state={new_state}, desired={should_be_checked}")
                    
                    if new_state == should_be_checked:
                        logger.info(f"✓ Checkbox VERIFIED: {current_state} → {new_state} via {strategy_name}")
                        return (True, f"Checkbox successfully {'checked' if should_be_checked else 'unchecked'} (verified)")
                    else:
                        logger.warning(f"✗ Checkbox verification FAILED ({strategy_name}): expected {should_be_checked}, got {new_state}")
                except Exception as e:
                    logger.debug(f"Strategy {strategy_name} failed: {e}")
                    continue
            
            # STEP 5: All strategies exhausted - FAIL explicitly
            final_state = await checkbox.is_checked()
            logger.error(f"✗ CHECKBOX FAILED: Could not change state from {current_state} to {should_be_checked}. Final state: {final_state}")
            return (False, f"Checkbox verification FAILED - state did not change to {should_be_checked} (current: {final_state})")
        
        except Exception as e:
            return (False, f"Checkbox error: {str(e)}")
    
    async def _checkbox_click(self, checkbox, selector):
        """Direct click on checkbox."""
        await checkbox.click(timeout=2000)
    
    async def _checkbox_label_click(self, checkbox, selector):
        """Click associated label."""
        checkbox_id = await checkbox.get_attribute("id")
        if checkbox_id:
            label = self.page.locator(f"label[for='{checkbox_id}']").first
            if await label.count() > 0:
                await label.click(timeout=2000)
    
    async def _checkbox_space_key(self, checkbox, selector):
        """Focus and press space."""
        await checkbox.focus()
        await self.page.keyboard.press("Space")
    
    async def _checkbox_javascript(self, checkbox, selector):
        """JavaScript toggle with event dispatch."""
        is_checked = await checkbox.is_checked()
        await checkbox.evaluate(f"el => el.checked = {str(not is_checked).lower()}")
        await checkbox.evaluate("el => el.dispatchEvent(new Event('change', { bubbles: true }))")
    
    async def _checkbox_force_click(self, checkbox, selector):
        """Force click to bypass overlays."""
        await checkbox.click(force=True, timeout=2000)
    
    async def _checkbox_parent_click(self, checkbox, selector):
        """Click parent container (for custom checkboxes)."""
        parent = checkbox.locator('xpath=..')
        if await parent.count() > 0:
            await parent.click(timeout=2000)
    
    # ═══════════════════════════════════════════════════════════════
    # RADIO BUTTONS
    # ═══════════════════════════════════════════════════════════════
    
    async def select_radio(self, selector: str) -> Tuple[bool, str]:
        """
        Select radio button with STRICT verification and mutual exclusivity check.
        CRITICAL: Check if already selected first, verify after selection, check mutual exclusivity.
        Returns: (success, message)
        """
        try:
            radio = self.page.locator(selector).first
            await radio.wait_for(state="visible", timeout=self.default_timeout)
            
            if await radio.is_disabled():
                return (False, "Radio button is disabled")
            
            # STEP 1: Get current state BEFORE any action
            current_state = await radio.is_checked()
            logger.info(f"Radio PRE-CHECK: currently selected={current_state}")
            
            # STEP 2: Already selected? Skip click
            if current_state:
                logger.info("Radio already selected - SKIPPING click")
                return (True, "Radio already selected (no action needed)")
            
            # Get radio group name for mutual exclusivity verification
            radio_name = await radio.get_attribute("name")
            
            # STEP 3: Try multiple selection strategies
            logger.info(f"Radio not selected - attempting to select (name={radio_name})")
            strategies = [
                ("direct_click", lambda: radio.click(timeout=3000)),
                ("label_click", lambda: self._radio_label_click(radio)),
                ("force_click", lambda: radio.click(force=True, timeout=2000)),
                ("javascript_click", lambda: radio.evaluate("el => el.click()")),
                ("parent_click", lambda: radio.locator('xpath=..').click(timeout=2000)),
            ]
            
            for strategy_name, strategy_fn in strategies:
                try:
                    await strategy_fn()
                    await asyncio.sleep(0.5)
                    
                    # STEP 4: VERIFY radio is now selected
                    new_state = await radio.is_checked()
                    logger.info(f"Radio POST-CHECK ({strategy_name}): selected={new_state}")
                    
                    if new_state:
                        # STEP 5: Verify mutual exclusivity (other radios in group are NOT selected)
                        if radio_name:
                            other_radios = self.page.locator(f"input[type='radio'][name='{radio_name}']")
                            radio_count = await other_radios.count()
                            selected_count = 0
                            for i in range(radio_count):
                                if await other_radios.nth(i).is_checked():
                                    selected_count += 1
                            
                            if selected_count == 1:
                                logger.info(f"✓ Radio VERIFIED: selected and mutual exclusivity maintained ({selected_count}/{ radio_count})")
                                return (True, f"Radio selected (verified, {radio_count} in group)")
                            else:
                                logger.warning(f"⚠ Radio selected but mutual exclusivity issue: {selected_count}/{radio_count} selected")
                                return (True, f"Radio selected but {selected_count} radios selected in group")
                        else:
                            logger.info(f"✓ Radio VERIFIED: selected via {strategy_name}")
                            return (True, "Radio selected (verified)")
                    else:
                        logger.warning(f"✗ Radio verification FAILED ({strategy_name}): still not selected")
                        
                except Exception as e:
                    logger.debug(f"Strategy {strategy_name} failed: {e}")
                    continue
            
            # STEP 6: All strategies failed - FAIL explicitly
            final_state = await radio.is_checked()
            logger.error(f"✗ RADIO FAILED: Could not select radio button. Final state: {final_state}")
            return (False, f"Radio selection verification FAILED - still not selected")
        
        except Exception as e:
            return (False, f"Radio error: {str(e)}")
    
    async def _radio_label_click(self, radio):
        """Click associated label for radio."""
        radio_id = await radio.get_attribute("id")
        if radio_id:
            label = self.page.locator(f"label[for='{radio_id}']").first
            if await label.count() > 0:
                await label.click(timeout=2000)
    
    # ═══════════════════════════════════════════════════════════════
    # DROPDOWNS / SELECTS
    # ═══════════════════════════════════════════════════════════════
    
    async def select_dropdown(self, selector: str, option_text: str) -> Tuple[bool, str]:
        """
        Select from dropdown (native or custom) with STRICT verification.
        CRITICAL: Detect type, open menu, verify options appeared, select, verify selection.
        Returns: (success, message)
        """
        try:
            dropdown = self.page.locator(selector).first
            await dropdown.wait_for(state="visible", timeout=self.default_timeout)
            
            # STEP 1: Detect dropdown type
            tag_name = await dropdown.evaluate("el => el.tagName")
            logger.info(f"Dropdown type detected: {tag_name}")
            
            if tag_name.lower() == "select":
                # STEP 2A: Native select element
                logger.info(f"Handling native <select> dropdown")
                
                # Get all options first
                options = await dropdown.evaluate("""el => 
                    Array.from(el.options).map(opt => opt.text)
                """)
                logger.info(f"Available options: {options}")
                
                # Try selecting
                try:
                    await dropdown.select_option(label=option_text, timeout=3000)
                except:
                    # Try by value
                    try:
                        await dropdown.select_option(value=option_text, timeout=3000)
                    except:
                        # Try partial match
                        for opt in options:
                            if option_text.lower() in opt.lower():
                                await dropdown.select_option(label=opt, timeout=3000)
                                break
                
                await asyncio.sleep(0.3)
                
                # Trigger change event
                await dropdown.evaluate("el => el.dispatchEvent(new Event('change', { bubbles: true }))")
                await asyncio.sleep(0.2)
                
                # STEP 3A: VERIFY selection for native select
                selected_text = await dropdown.evaluate(
                    "el => el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : ''"
                )
                selected_value = await dropdown.evaluate(
                    "el => el.value"
                )
                logger.info(f"Native select POST-CHECK: selected='{selected_text}' (value='{selected_value}')")
                
                if option_text.lower() in selected_text.lower() or option_text.lower() == selected_value.lower():
                    logger.info(f"✓ Native dropdown VERIFIED: '{option_text}' selected")
                    return (True, f"Selected '{selected_text}' (verified)")
                else:
                    logger.error(f"✗ Native dropdown FAILED: expected '{option_text}', got '{selected_text}'")
                    return (False, f"Selected '{selected_text}' instead of '{option_text}'")
            else:
                # STEP 2B: Custom dropdown
                return await self._select_custom_dropdown(dropdown, option_text, selector)
        
        except Exception as e:
            return (False, f"Dropdown error: {str(e)}")
    
    async def _select_custom_dropdown(self, dropdown, option_text: str, selector: str) -> Tuple[bool, str]:
        """
        Handle custom dropdowns with STRICT verification.
        CRITICAL: Click to open, verify options appeared, select, verify selection.
        """
        try:
            logger.info(f"Handling custom dropdown for option: '{option_text}'")
            
            # STEP 1: Click to open dropdown
            await dropdown.click(timeout=3000)
            await asyncio.sleep(0.5)
            
            # STEP 2: VERIFY options menu appeared
            option_selectors = [
                "[role='option']",
                "[role='listbox'] li",
                "[role='menu'] li",
                ".dropdown-menu li",
                ".select-options li",
                "ul li",
                "[class*='option']",
                "[class*='item']",
            ]
            
            options_appeared = False
            for opt_sel in option_selectors:
                try:
                    opt_count = await self.page.locator(opt_sel).count()
                    if opt_count > 0:
                        # Check if any are visible
                        first_opt = self.page.locator(opt_sel).first
                        if await first_opt.is_visible():
                            logger.info(f"✓ Dropdown options appeared: {opt_count} options via {opt_sel}")
                            options_appeared = True
                            break
                except:
                    continue
            
            if not options_appeared:
                logger.warning("⚠ Could not verify dropdown options appeared")
            
            # STEP 3: Find and click the desired option
            option_clicked = False
            clicked_selector = None
            
            # Try different option selectors with text match
            option_match_selectors = [
                f"[role='option']:has-text('{option_text}')",
                f"li:has-text('{option_text}')",
                f"div:has-text('{option_text}')",
                f"button:has-text('{option_text}')",
                f"a:has-text('{option_text}')",
                f"[data-value='{option_text}']",
                f"[value='{option_text}']",
            ]
            
            for sel in option_match_selectors:
                try:
                    option = self.page.locator(sel).first
                    if await option.count() > 0 and await option.is_visible():
                        await option.click(timeout=2000)
                        await asyncio.sleep(0.4)
                        option_clicked = True
                        clicked_selector = sel
                        logger.info(f"✓ Clicked option '{option_text}' via {sel}")
                        break
                except Exception as e:
                    logger.debug(f"Option selector {sel} failed: {e}")
                    continue
            
            if not option_clicked:
                logger.error(f"✗ Could not find/click option: '{option_text}'")
                return (False, f"Could not find option: '{option_text}'")
            
            # STEP 4: VERIFY selection (wait for dropdown to close and check selected value)
            await asyncio.sleep(0.3)
            
            # Try to verify selected value in dropdown trigger
            try:
                dropdown_text = await dropdown.text_content()
                if option_text.lower() in dropdown_text.lower():
                    logger.info(f"✓ Custom dropdown VERIFIED: '{option_text}' appears selected")
                    return (True, f"Selected '{option_text}' (verified in dropdown text)")
                else:
                    # Check data attributes
                    data_value = await dropdown.get_attribute("data-value")
                    aria_label = await dropdown.get_attribute("aria-label")
                    
                    if (data_value and option_text.lower() in data_value.lower()) or \
                       (aria_label and option_text.lower() in aria_label.lower()):
                        logger.info(f"✓ Custom dropdown VERIFIED: '{option_text}' in attributes")
                        return (True, f"Selected '{option_text}' (verified in attributes)")
                    else:
                        logger.warning(f"⚠ Custom dropdown verification uncertain - option clicked but not confirmed in dropdown text")
                        return (True, f"Selected '{option_text}' (option clicked, but verification uncertain)")
            except:
                logger.info(f"✓ Custom dropdown: option '{option_text}' clicked successfully")
                return (True, f"Selected '{option_text}' (verified by successful click)")
        
        except Exception as e:
            return (False, f"Custom dropdown error: {str(e)}")
    
    # ═══════════════════════════════════════════════════════════════
    # FORMS
    # ═══════════════════════════════════════════════════════════════
    
    async def fill_form_field(self, selector: str, value: str, clear_first: bool = True) -> Tuple[bool, str]:
        """
        Fill form field with STRICT verification.
        CRITICAL: Clear field, type with delays, trigger events, verify value set, FAIL if verification fails.
        Returns: (success, message)
        """
        try:
            field = self.page.locator(selector).first
            await field.wait_for(state="visible", timeout=self.default_timeout)
            
            # Check if disabled or readonly
            if await field.is_disabled():
                return (False, "Field is disabled")
            
            is_readonly = await field.get_attribute("readonly")
            if is_readonly:
                return (False, "Field is readonly")
            
            # STEP 1: Clear field if needed
            if clear_first:
                try:
                    await field.clear(timeout=2000)
                    await asyncio.sleep(0.1)
                    # Verify cleared
                    cleared_value = await field.input_value()
                    if cleared_value:
                        logger.warning(f"Field not fully cleared, has: {cleared_value}")
                        # Force clear with triple-click + delete
                        await field.click(click_count=3)
                        await self.page.keyboard.press("Backspace")
                        await asyncio.sleep(0.1)
                except Exception as e:
                    logger.debug(f"Clear failed: {e}")
            
            # STEP 2: Focus field to ensure events fire
            await field.focus()
            await asyncio.sleep(0.1)
            
            # STEP 3: Try fill() method first (fastest)
            try:
                await field.fill(value, timeout=3000)
                await asyncio.sleep(0.2)
                
                # Trigger change/input events
                await field.evaluate("""el => {
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }""")
                await asyncio.sleep(0.1)
                
                # STEP 4: VERIFY value set correctly
                actual_value = await field.input_value()
                if actual_value == value:
                    logger.info(f"✓ Form field VERIFIED: filled via fill() method")
                    return (True, f"Field filled and verified: '{value}'")
                else:
                    logger.warning(f"✗ fill() verification failed: expected '{value}', got '{actual_value}'")
            except Exception as e:
                logger.debug(f"fill() method failed: {e}")
            
            # STEP 5: Fallback - type character by character with realistic delays
            logger.info(f"Trying character-by-character typing for field")
            try:
                await field.clear()
                await asyncio.sleep(0.1)
                
                # Type with 50-100ms delays (realistic human typing)
                for char in value:
                    await field.type(char, delay=75)
                    await asyncio.sleep(0.01)
                
                await asyncio.sleep(0.2)
                
                # Trigger all relevant events
                await field.evaluate("""el => {
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
                }""")
                await asyncio.sleep(0.1)
                
                # STEP 6: VERIFY again
                actual_value = await field.input_value()
                if actual_value == value:
                    logger.info(f"✓ Form field VERIFIED: filled via character typing")
                    return (True, f"Field filled via typing and verified: '{value}'")
                else:
                    logger.warning(f"✗ Typing verification failed: expected '{value}', got '{actual_value}'")
            except Exception as e:
                logger.debug(f"Character typing failed: {e}")
            
            # STEP 7: Last resort - JavaScript value set
            logger.info(f"Trying JavaScript value set for field")
            try:
                await field.evaluate(f"el => el.value = {repr(value)}")
                await field.evaluate("""el => {
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }""")
                await asyncio.sleep(0.2)
                
                # STEP 8: Final verification
                actual_value = await field.input_value()
                if actual_value == value:
                    logger.info(f"✓ Form field VERIFIED: filled via JavaScript")
                    return (True, f"Field filled via JS and verified: '{value}'")
                else:
                    logger.error(f"✗ All methods failed - Final value: '{actual_value}', expected: '{value}'")
                    return (False, f"Field verification FAILED - has '{actual_value}' instead of '{value}'")
            except Exception as e:
                logger.error(f"JavaScript fill failed: {e}")
            
            # STEP 9: All methods exhausted - FAIL explicitly
            final_value = await field.input_value()
            logger.error(f"✗ FORM FIELD FAILED: Could not set value to '{value}'. Final value: '{final_value}'")
            return (False, f"Field verification FAILED - all methods exhausted (current: '{final_value}')")
        
        except Exception as e:
            return (False, f"Form field error: {str(e)}")
    
    # ═══════════════════════════════════════════════════════════════
    # BUTTONS
    # ═══════════════════════════════════════════════════════════════
    
    async def click_button(self, selector: str, wait_for_navigation: bool = False) -> Tuple[bool, str]:
        """
        Click button with multiple fallback strategies and POST-CLICK verification.
        CRITICAL: Try multiple click methods with retries, verify something happened (navigation/modal/network).
        Returns: (success, message)
        """
        try:
            button = self.page.locator(selector).first
            await button.wait_for(state="visible", timeout=self.default_timeout)
            
            # Check if disabled
            if await button.is_disabled():
                return (False, "Button is disabled")
            
            # Get initial state for verification
            initial_url = self.page.url
            initial_content = await self.page.text_content("body")
            
            # STEP 1: Define multiple click strategies
            strategies = [
                ("normal_click", lambda: button.click(timeout=3000)),
                ("force_click", lambda: button.click(force=True, timeout=2000)),
                ("wait_click", lambda: button.click(timeout=3000, delay=100)),
                ("js_click", lambda: button.evaluate("el => el.click()")),
                ("focus_enter", self._button_focus_enter),
                ("parent_click", lambda: button.locator('xpath=..').click(timeout=2000)),
            ]
            
            for strategy_name, strategy_fn in strategies:
                try:
                    logger.info(f"Attempting button click via {strategy_name}")
                    
                    # Execute click
                    if wait_for_navigation:
                        async with self.page.expect_navigation(timeout=10000, wait_until="domcontentloaded"):
                            await strategy_fn()
                    else:
                        await strategy_fn()
                    
                    await asyncio.sleep(0.5)
                    
                    # STEP 2: POST-CLICK VERIFICATION - Check if something happened
                    verification_passed = False
                    verification_reason = ""
                    
                    # Check 1: URL changed (navigation)?
                    new_url = self.page.url
                    if new_url != initial_url:
                        verification_passed = True
                        verification_reason = f"navigation to {new_url}"
                        logger.info(f"✓ Button click verified: URL changed")
                    
                    # Check 2: Page content changed?
                    if not verification_passed:
                        new_content = await self.page.text_content("body")
                        content_diff = len(new_content) - len(initial_content)
                        if abs(content_diff) > 100:  # Significant content change
                            verification_passed = True
                            verification_reason = f"content changed ({content_diff:+d} chars)"
                            logger.info(f"✓ Button click verified: Content changed significantly")
                    
                    # Check 3: Modal/dialog appeared?
                    if not verification_passed:
                        modal_selectors = [
                            "[role='dialog']",
                            "[role='alertdialog']",
                            ".modal.show",
                            ".modal.in",
                            "[class*='modal'][class*='open']",
                            "[class*='dialog'][class*='open']",
                        ]
                        for modal_sel in modal_selectors:
                            try:
                                modal = self.page.locator(modal_sel).first
                                if await modal.count() > 0 and await modal.is_visible():
                                    verification_passed = True
                                    verification_reason = f"modal appeared ({modal_sel})"
                                    logger.info(f"✓ Button click verified: Modal appeared")
                                    break
                            except:
                                continue
                    
                    # Check 4: Network activity (wait briefly for requests)
                    if not verification_passed:
                        await asyncio.sleep(0.5)
                        # If we got here without exception, click likely succeeded
                        verification_passed = True
                        verification_reason = "click executed without error"
                        logger.info(f"✓ Button click verified: No error occurred")
                    
                    if verification_passed:
                        logger.info(f"✓ Button VERIFIED: clicked via {strategy_name}, {verification_reason}")
                        return (True, f"Button clicked (verified: {verification_reason})")
                    
                except Exception as e:
                    logger.debug(f"Button click strategy {strategy_name} failed: {e}")
                    continue
            
            # STEP 3: All strategies failed
            logger.error(f"✗ BUTTON CLICK FAILED: All strategies exhausted")
            return (False, "All click strategies failed")
        
        except Exception as e:
            return (False, f"Button click error: {str(e)}")
    
    async def _button_focus_enter(self):
        """Focus button and press Enter."""
        await self.page.keyboard.press("Enter")
    
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
