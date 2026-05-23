from cryptography.fernet import Fernet
from app.core.config import settings


def _load_fernet() -> Fernet:
 key = settings.FERNET_KEY
 if not key or key.startswith("CHANGE_ME"):
  raise RuntimeError(
   "FERNET_KEY is not configured. Generate with: "
   "python3 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())' "
   "and set it as its own env variable (do not derive from SECRET_KEY)."
  )
 if isinstance(key, str):
  key = key.encode()
 if not isinstance(key, (bytes, bytearray)):
  raise RuntimeError(
   f"FERNET_KEY must be str or bytes, got {type(key).__name__}"
  )
 try:
  return Fernet(key)
 except Exception as exc:
  raise RuntimeError(
   f"FERNET_KEY is invalid (must be 32 url-safe base64 bytes): {exc}"
  ) from exc


_fernet = _load_fernet()


def encrypt(plaintext: str) -> str:
 return _fernet.encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
 return _fernet.decrypt(ciphertext.encode()).decode()
