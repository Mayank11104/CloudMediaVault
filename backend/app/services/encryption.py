import base64
import hashlib
import os
from typing import Tuple
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from app.config import COOKIE_ENCRYPTION_KEY


class FileEncryption:
    """
    File encryption service using AES-GCM with user-specific keys.
    """
    SALT = b"file_secure_v1_prod"
    ITERATIONS = 600_000
    
    @staticmethod
    def derive_key(user_id: str) -> bytes:
        """
        Derive encryption key from user ID and master key.
        
        Args:
            user_id: User's Cognito sub
            
        Returns:
            bytes: 32-byte AES-256 key
        """
        password = f"file_v1_{COOKIE_ENCRYPTION_KEY}_{user_id}".encode('utf-8')
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,  # AES-256
            salt=FileEncryption.SALT,
            iterations=FileEncryption.ITERATIONS,
        )
        return kdf.derive(password)
    
    @staticmethod
    def encrypt_file(file_bytes: bytes, user_id: str) -> Tuple[bytes, str]:
        """
        Encrypt file content and compute hash.
        
        Args:
            file_bytes: Raw file content
            user_id: User's Cognito sub
            
        Returns:
            tuple: (encrypted_bytes, sha256_hash)
        """
        key = FileEncryption.derive_key(user_id)
        aesgcm = AESGCM(key)
        nonce = os.urandom(12)
        ciphertext = aesgcm.encrypt(nonce, file_bytes, None)
        full_encrypted = nonce + ciphertext  # nonce|ciphertext
        file_hash = hashlib.sha256(file_bytes).hexdigest()
        return full_encrypted, file_hash
    
    @staticmethod
    def decrypt_file(full_encrypted: bytes, user_id: str) -> bytes:
        """
        Decrypt file content.
        
        Args:
            full_encrypted: Encrypted file (nonce + ciphertext)
            user_id: User's Cognito sub
            
        Returns:
            bytes: Decrypted file content
            
        Raises:
            ValueError: If encrypted data is invalid
        """
        if len(full_encrypted) < 12:
            raise ValueError("Invalid encrypted data")
        key = FileEncryption.derive_key(user_id)
        aesgcm = AESGCM(key)
        nonce = full_encrypted[:12]
        ciphertext = full_encrypted[12:]
        return aesgcm.decrypt(nonce, ciphertext, None)
