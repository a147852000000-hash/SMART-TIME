-- READ-ONLY PREVIEW: inspect the single approved owner account before any role changes.
-- Run with: sqlite3 -readonly /path/to/staging-or-production-copy.db < scripts/sql/preview-approved-owners.sql
.headers on
.mode column
PRAGMA query_only = ON;

SELECT id, lower(trim(email)) AS approved_email, role
FROM users
WHERE lower(trim(email)) IN (
  'eng.mamdouh2009@gmail.com'
)
ORDER BY lower(trim(email));

SELECT
  COUNT(*) AS matching_rows,
  COUNT(DISTINCT lower(trim(email))) AS distinct_approved_emails,
  CASE
    WHEN COUNT(*) = 1 AND COUNT(DISTINCT lower(trim(email))) = 1
      THEN 'READY FOR MANUAL REVIEW'
    ELSE 'STOP: expected exactly one approved owner account'
  END AS review_status
FROM users
WHERE lower(trim(email)) IN (
  'eng.mamdouh2009@gmail.com'
);
