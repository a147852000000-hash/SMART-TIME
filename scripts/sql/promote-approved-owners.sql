-- APPLY STEP — intentionally does NOT COMMIT.
-- First run scripts/sql/preview-approved-owners.sql against a read-only copy and review it.
-- Open the intended database interactively using sqlite3, then use:
--   .bail on
--   .read scripts/sql/promote-approved-owners.sql
-- Inspect the resulting rows; issue COMMIT manually only after approval.
-- If run non-interactively, SQLite rolls back the uncommitted transaction when it exits.
.bail on
.headers on
.mode column

BEGIN IMMEDIATE;

-- RAISE(ROLLBACK) guarantees a failed precondition rolls back the transaction.
-- .bail on prevents the CLI from continuing to the UPDATE after a failed guard.
CREATE TEMP TABLE _smart_time_owner_promotion_guard (ok INTEGER NOT NULL);
CREATE TEMP TRIGGER _smart_time_owner_promotion_guard_assert
BEFORE INSERT ON _smart_time_owner_promotion_guard
WHEN NEW.ok <> 1
BEGIN
  SELECT RAISE(ROLLBACK, 'Owner promotion aborted: exactly one approved owner account and exactly one role change are required.');
END;

INSERT INTO _smart_time_owner_promotion_guard(ok)
SELECT CASE
  WHEN COUNT(*) = 1 AND COUNT(DISTINCT lower(trim(email))) = 1 THEN 1
  ELSE 0
END
FROM users
WHERE lower(trim(email)) IN (
  'eng.mamdouh2009@gmail.com'
);

UPDATE users
SET role = 'owner'
WHERE lower(trim(email)) IN (
  'eng.mamdouh2009@gmail.com'
)
AND role <> 'owner';

-- changes() refers to the UPDATE immediately above. Anything other than exactly 1
-- changed row raises ROLLBACK; already-owner rows therefore fail closed.
INSERT INTO _smart_time_owner_promotion_guard(ok)
VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END);

DROP TRIGGER _smart_time_owner_promotion_guard_assert;
DROP TABLE _smart_time_owner_promotion_guard;

SELECT id, lower(trim(email)) AS approved_email, role
FROM users
WHERE lower(trim(email)) IN (
  'eng.mamdouh2009@gmail.com'
)
ORDER BY lower(trim(email));

.print 'PROMOTION PREPARED BUT NOT COMMITTED. Review the rows, then execute COMMIT manually or ROLLBACK.'
