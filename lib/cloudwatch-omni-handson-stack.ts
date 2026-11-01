import { fileURLToPath } from 'node:url';
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

/** Log-producing resources only. Set up the Omni domain, space and Dataset separately. */
export class CloudWatchOmniHandsonStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    const logGroup = new logs.LogGroup(this, 'ApplicationLogs', {
      logGroupClass: logs.LogGroupClass.STANDARD,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const executionRole = new iam.Role(this, 'FunctionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Write sample application logs to the dedicated hands-on log group',
    });
    logGroup.grantWrite(executionRole);

    const fn = new lambda.Function(this, 'LogProducer', {
      description: 'Emit synthetic success, warning and error logs for CloudWatch Omni',
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(fileURLToPath(new URL('../lambda/', import.meta.url))),
      role: executionRole,
      logGroup,
      loggingFormat: lambda.LoggingFormat.JSON,
      applicationLogLevelV2: lambda.ApplicationLogLevel.INFO,
      systemLogLevelV2: lambda.SystemLogLevel.WARN,
      timeout: Duration.seconds(5),
      memorySize: 128,
      reservedConcurrentExecutions: 1,
    });

    new CfnOutput(this, 'FunctionName', { value: fn.functionName });
    new CfnOutput(this, 'LogGroupName', { value: logGroup.logGroupName });
    new CfnOutput(this, 'DeploymentRegion', { value: this.region });
  }
}
