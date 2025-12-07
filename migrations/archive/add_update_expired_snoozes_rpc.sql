CREATE OR REPLACE FUNCTION update_expired_snoozes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE service_opportunities
  SET 
    status = 'Open',
    snooze_until = NULL,
    updated_at = NOW()
  WHERE 
    status = 'Snoozed' 
    AND snooze_until <= NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION update_expired_snoozes() TO authenticated;
