"""
PART 2A: Cryptographic utilities for secrets encryption/decryption.
Uses Fernet symmetric encryption. Key stored in SECRETS_ENCRYPTION_KEY env var.
"""
import os
import secrets
from cryptography.fernet import Fernet
from utils.logger import get_logger

logger = get_logger(__name__)


def get_or_create_key() -> bytes:
    """Get Fernet key from env, or generate one if missing (dev mode)."""
    key_str = os.environ.get("SECRETS_ENCRYPTION_KEY", "")
    if key_str:
        try:
            return key_str.encode()
        except Exception:
            pass
    # Auto-generate a key for development (not recommended for production)
    logger.warning("SECRETS_ENCRYPTION_KEY not set — generating ephemeral key (dev mode)")
    return Fernet.generate_key()


_fernet: Fernet | None = None


def get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        _fernet = Fernet(get_or_create_key())
    return _fernet


def encrypt_value(plain_text: str) -> str:
    """Encrypt a plain text string and return base64-encoded ciphertext."""
    if not plain_text:
        return ""
    try:
        return get_fernet().encrypt(plain_text.encode()).decode()
    except Exception as e:
        logger.error(f"Encryption failed: {e}")
        raise


def decrypt_value(cipher_text: str) -> str:
    """Decrypt a base64-encoded ciphertext and return plain text."""
    if not cipher_text:
        return ""
    try:
        return get_fernet().decrypt(cipher_text.encode()).decode()
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        raise ValueError("Failed to decrypt value — encryption key may have changed")


def generate_token(length: int = 32) -> str:
    """Generate a secure random token."""
    return secrets.token_urlsafe(length)
