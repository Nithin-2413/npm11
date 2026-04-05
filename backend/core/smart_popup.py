"""Smart Popup Detection & Handling - Balanced 2s timeout approach."""
import asyncio
from typing import List, Tuple
import logging

logger = logging.getLogger(__name__)


class SmartPopupDetector:
    """Intelligent popup detection that never assumes existence."""
    
    def __init__(self, page):
        self.page = page
        self.timeout = 2000  # Balanced: 2 seconds
    
    async def detect_and_close(self) -> Tuple[bool, List[str]]:
        """
        Detect and close popups intelligently.
        Returns: (popup_found, actions_taken)
        """
        actions_taken = []
        
        # STEP 1: Quick visual check - are there high z-index elements?
        has_overlay = await self._check_for_overlay()
        if not has_overlay:
            logger.debug("No overlay detected - skipping popup check")
            return (False, [])
        
        logger.info("Overlay detected - attempting to close popup")
        
        # STEP 2: Try cookie consent banners (most common)
        closed = await self._try_cookie_banners()
        if closed:
            actions_taken.append("cookie_banner")
            await asyncio.sleep(0.3)
            return (True, actions_taken)
        
        # STEP 3: Try modal close buttons
        closed = await self._try_modal_close()
        if closed:
            actions_taken.append("modal_close")
            await asyncio.sleep(0.3)
            return (True, actions_taken)
        
        # STEP 4: Try ESC key
        try:
            await self.page.keyboard.press("Escape")
            await asyncio.sleep(0.5)
            # Check if overlay is gone
            still_has_overlay = await self._check_for_overlay()
            if not still_has_overlay:
                actions_taken.append("esc_key")
                logger.info("Closed popup with ESC key")
                return (True, actions_taken)
        except Exception:
            pass
        
        # STEP 5: Try clicking overlay backdrop
        closed = await self._try_backdrop_click()
        if closed:
            actions_taken.append("backdrop_click")
            return (True, actions_taken)
        
        logger.debug("Popup detected but could not close")
        return (True, [])  # Found but couldn't close
    
    async def _check_for_overlay(self) -> bool:
        """Fast check for high z-index elements or modal backdrops."""
        try:
            # Check for common overlay/backdrop elements
            overlay_selectors = [
                "[class*='overlay']",
                "[class*='backdrop']",
                "[class*='modal']",
                "[role='dialog']",
                "[aria-modal='true']",
            ]
            
            for sel in overlay_selectors:
                count = await self.page.locator(sel).count()
                if count > 0:
                    return True
            
            return False
        except Exception:
            return False
    
    async def _try_cookie_banners(self) -> bool:
        """Try clicking cookie consent buttons."""
        cookie_selectors = [
            "button:has-text('Accept')",
            "button:has-text('Accept All')",
            "button:has-text('Accept Cookies')",
            "button:has-text('I Agree')",
            "button:has-text('Allow All')",
            "#acceptBtn",
            "[id*='cookie-accept']",
        ]
        
        for sel in cookie_selectors:
            try:
                loc = self.page.locator(sel).first
                if await loc.count() > 0 and await loc.is_visible():
                    await loc.click(timeout=self.timeout)
                    logger.info(f"Clicked cookie banner: {sel}")
                    return True
            except Exception:
                continue
        
        return False
    
    async def _try_modal_close(self) -> bool:
        """Try clicking modal close buttons."""
        close_selectors = [
            "button[aria-label*='close' i]",
            "button[aria-label*='dismiss' i]",
            "[data-dismiss='modal']",
            "button:has-text('×')",
            "button:has-text('✕')",
            "button:has-text('Close')",
            ".modal .close",
            ".popup-close",
        ]
        
        for sel in close_selectors:
            try:
                loc = self.page.locator(sel).first
                if await loc.count() > 0 and await loc.is_visible():
                    await loc.click(timeout=self.timeout)
                    logger.info(f"Clicked close button: {sel}")
                    return True
            except Exception:
                continue
        
        return False
    
    async def _try_backdrop_click(self) -> bool:
        """Try clicking the backdrop/overlay to close modal."""
        try:
            backdrop = self.page.locator("[class*='backdrop'], [class*='overlay']").first
            if await backdrop.count() > 0 and await backdrop.is_visible():
                await backdrop.click(timeout=self.timeout, position={"x": 5, "y": 5})
                await asyncio.sleep(0.5)
                logger.info("Clicked backdrop")
                return True
        except Exception:
            pass
        
        return False
