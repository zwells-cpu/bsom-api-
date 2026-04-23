async function logAuditEvent(db, {
  user_id = null,
  user_email = null,
  user_role = null,
  action,
  entity_type = null,
  entity_id = null,
  entity_label = null,
  description = null,
  details_json = {},
  ip_address = null,
  user_agent = null,
}) {
  if (!action) {
    console.error('logAuditEvent called without action');
    return;
  }

  try {
    await db.query(
      `INSERT INTO audit_logs (
        user_id,
        user_email,
        user_role,
        action,
        entity_type,
        entity_id,
        entity_label,
        description,
        details_json,
        ip_address,
        user_agent
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)`,
      [
        user_id,
        user_email,
        user_role,
        action,
        entity_type,
        entity_id,
        entity_label,
        description,
        JSON.stringify(details_json || {}),
        ip_address,
        user_agent
      ]
    );
  } catch (error) {
    console.error('Audit log failed:', error.message);
  }
}

module.exports = { logAuditEvent };