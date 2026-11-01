-- CloudWatch Omni SQL. Not CloudWatch Logs Insights QL.
-- These queries have not been executed against a live Omni space.
-- Replace REPLACE_WITH_LOG_GROUP_NAME with the deployed LogGroupName output.
-- Run one statement at a time. Start with the raw records and inspect the actual fields.

SELECT `@timestamp`, `@record`, `@logGroupName`
FROM "logs.default"
WHERE `@timestamp` BETWEEN NOW() - INTERVAL '15' MINUTE AND NOW()
  AND `@logGroupName` = 'REPLACE_WITH_LOG_GROUP_NAME'
ORDER BY `@timestamp` DESC
LIMIT 100;

-- Lambda JSON logging places the console object inside message.
-- Confirm the discovered schema in Browse before running the following statements.
SELECT `@timestamp`, level, requestId, message
FROM "logs.default"
WHERE `@timestamp` BETWEEN NOW() - INTERVAL '15' MINUTE AND NOW()
  AND `@logGroupName` = 'REPLACE_WITH_LOG_GROUP_NAME'
  AND message['service'] = 'omni-handson-orders'
  AND level = 'ERROR'
ORDER BY `@timestamp` DESC
LIMIT 20;

SELECT `@timestamp`, level, requestId, message
FROM "logs.default"
WHERE `@timestamp` BETWEEN NOW() - INTERVAL '15' MINUTE AND NOW()
  AND `@logGroupName` = 'REPLACE_WITH_LOG_GROUP_NAME'
  AND requestId = 'REPLACE_WITH_REQUEST_ID'
ORDER BY `@timestamp` ASC
LIMIT 100;
