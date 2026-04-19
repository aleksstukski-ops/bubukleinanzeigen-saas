from cryptography.fernet import Fernet
from app.core.config import settings


_key = settings.FERNET_KEY
if isinstance(_key, str):
 _key = _key.encode()

_fernet = Fernet(_key)


def encrypt(plaintext: str) -> str:
 return _fernet.encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
 return _fernet.decrypt(ciphertext.encode()).decode()
