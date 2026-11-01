# CloudWatch Logs Insights QL. Run in the classic CloudWatch Logs Insights UI.
# Select the deployed LogGroupName and a 15-minute time range first.
fields @timestamp, level, requestId, message.event, message.errorCode
| filter message.service = "omni-handson-orders"
| sort @timestamp desc
| limit 100
