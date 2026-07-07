-- Create push_subscriptions table for storing notification subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(50) NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT,
  auth TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quick phone lookup
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_phone ON push_subscriptions(phone);

-- Create notification_logs table for tracking sent notifications
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL, -- 'reminder_30min', 'ending_10min'
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'sent', -- 'sent', 'failed', 'delivered'
  error_message TEXT
);

-- Index to prevent duplicate notifications
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_logs_unique 
  ON notification_logs(reservation_id, notification_type);
