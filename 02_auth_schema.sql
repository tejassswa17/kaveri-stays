CREATE TABLE accounts (
    account_id BIGSERIAL PRIMARY KEY,

    guest_id BIGINT UNIQUE
        REFERENCES guests(guest_id)
        ON DELETE RESTRICT,

    email VARCHAR(255) NOT NULL,

    password_hash TEXT NOT NULL,

    role VARCHAR(20) NOT NULL,

    property_id BIGINT
        REFERENCES properties(property_id)
        ON DELETE RESTRICT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_account_role
        CHECK (
            role IN (
                'guest',
                'staff',
                'manager',
                'owner'
            )
        ),

    CONSTRAINT chk_account_property_scope
        CHECK (
            (
                role IN ('staff', 'manager')
                AND property_id IS NOT NULL
            )
            OR
            (
                role IN ('guest', 'owner')
                AND property_id IS NULL
            )
        )
);

CREATE UNIQUE INDEX uq_accounts_email_lower
ON accounts (LOWER(email));


CREATE TABLE refresh_tokens (
    refresh_token_id BIGSERIAL PRIMARY KEY,

    account_id BIGINT NOT NULL
        REFERENCES accounts(account_id)
        ON DELETE CASCADE,

    token_hash TEXT NOT NULL UNIQUE,

    expires_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    revoked_at TIMESTAMPTZ
);