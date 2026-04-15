import json
from datetime import datetime, timezone
from typing import Any

from app.core.crypto import decrypt, encrypt
from app.models import KleinanzeigenAccount


def encrypt_storage_state(storage_state: dict[str, Any]) -> str:
	payload = json.dumps(storage_state, ensure_ascii=False, separators=(",", ":"))
	return encrypt(payload)


def decrypt_storage_state(ciphertext: str) -> dict[str, Any]:
	payload = decrypt(ciphertext)
	data = json.loads(payload)
	if not isinstance(data, dict):
		raise ValueError("Decrypted storage state must be a JSON object")
	return data


def get_account_storage_state(account: KleinanzeigenAccount) -> dict[str, Any]:
	if not account.session_encrypted:
		raise ValueError("Account has no encrypted session")
	return decrypt_storage_state(account.session_encrypted)


def set_account_storage_state(account: KleinanzeigenAccount, storage_state: dict[str, Any]) -> None:
	account.session_encrypted = encrypt_storage_state(storage_state)
	account.session_updated_at = datetime.now(timezone.utc)