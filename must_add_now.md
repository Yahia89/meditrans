But you must now add:

Provider Credential Management

You need an org_billing_credentials table:

org_id
mnits_enabled (boolean)
sftp_host
sftp_port
sftp_username (encrypted)
sftp_password (encrypted)
submitter_id
npi
last_password_rotation
batch_test_status (pending | approved)

Encrypt credentials using:
• Envelope encryption
• Per-org key (ideally)
• Never log credentials

⸻

Extremely Important: Password Expiration

MN-ITS FTP passwords expire every 3 months.

Your system must support:
• Admin updating credentials
• Alert before expiration
• Failure handling if auth fails
• Mark org as “credentials invalid”

This is critical.

But:

👉 Full automation requires each provider to be separately enabled for Secure FTP batch.
👉 That does NOT come automatically with MN-ITS login.
👉 Most small providers do NOT have this enabled yet.
👉 You must build secure credential storage.
👉 You must handle password rotation.
👉 You must treat each org as its own Trading Partner.

⸻
