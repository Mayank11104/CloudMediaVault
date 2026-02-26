from app.services.encryption import FileEncryption

def test_encryption_roundtrip():
    user_id = "test-user"
    original = b"Hello encrypted world!"
    
    encrypted, _ = FileEncryption.encrypt_file(original, user_id)
    decrypted = FileEncryption.decrypt_file(encrypted, user_id)
    
    assert decrypted == original
    print("✅ Encryption test PASSED!")
