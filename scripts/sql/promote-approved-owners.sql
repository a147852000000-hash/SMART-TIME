-- Prepared SQL only. Review and execute manually during an approved Phase 2.
-- Never run against a production database until its backup and restore test pass.
-- Only these two exact, existing email accounts can be promoted by this script.
-- It intentionally does not create accounts and does not demote any other account.
BEGIN IMMEDIATE;

UPDATE users
SET role = 'owner'
WHERE lower(trim(email)) IN (
  'eng.mamdouh2009@gmail.com',
  'mamdouh.oracle.2026@gmail.com'
)
AND role <> 'owner';

-- Review the result before COMMIT in an interactive transaction:
-- SELECT id, lower(trim(email)) AS email, role
-- FROM users
-- WHERE lower(trim(email)) IN (
--   'eng.mamdouh2009@gmail.com',
--   'mamdouh.oracle.2026@gmail.com'
-- );
--
-- If either account is missing, stop and ROLLBACK; do not create it here.
COMMIT;
