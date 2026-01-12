CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    is_subscribed BOOLEAN DEFAULT false,
    favorite_service VARCHAR(100),
    notifications_enabled BOOLEAN DEFAULT true,
    reminder_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE temp_emails (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    email VARCHAR(255) NOT NULL,
    country_code VARCHAR(10) NOT NULL,
    country_name VARCHAR(100) NOT NULL,
    country_flag VARCHAR(10) NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    service_emoji VARCHAR(10) NOT NULL,
    received_code VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_archived BOOLEAN DEFAULT false
);

CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_temp_emails_user_id ON temp_emails(user_id);
CREATE INDEX idx_temp_emails_expires_at ON temp_emails(expires_at);
CREATE INDEX idx_temp_emails_is_archived ON temp_emails(is_archived);